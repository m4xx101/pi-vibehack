// v1.4 Phase 1 — lazy tool registry (CS-faithful pattern).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("lazy-tools registry", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-lazy-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const eng = newEngagementId("lazy-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("buildLazyTools generates one wrapper per catalog entry", async () => {
    const { buildLazyTools, lazyToolName, LAZY_TOOL_NAMES } =
      await import("../extensions/pi-vibehack/lib/lazy-tools.ts");
    const { TOOL_CATALOG } = await import("../extensions/pi-vibehack/data/tool-catalog.ts");
    const tools = buildLazyTools({ exec: async () => ({ code: 0, stdout: "", stderr: "", killed: false }) });
    expect(tools.length).toBe(TOOL_CATALOG.length);
    for (const t of tools) expect(t.name.startsWith("vibehack_run_")).toBe(true);
    expect(LAZY_TOOL_NAMES).toContain(lazyToolName(TOOL_CATALOG[0]));
  });

  it("vibehack_load_tools persists IDs and rejects unknown ones", async () => {
    const { loadToolsTool, getLoadedSet, lazyToolName } =
      await import("../extensions/pi-vibehack/lib/lazy-tools.ts");
    const { TOOL_CATALOG } = await import("../extensions/pi-vibehack/data/tool-catalog.ts");
    const id = lazyToolName(TOOL_CATALOG.find((t) => t.name === "nuclei")!);
    const r: any = await (loadToolsTool as any).execute("c", { tool_ids: [id, "vibehack_run_bogus"] });
    expect(r.loaded).toContain(id);
    expect(r.rejected).toContain("vibehack_run_bogus");
    const { activeEngagementId } = await import("../extensions/pi-vibehack/lib/engagement.ts");
    const eng = await activeEngagementId();
    const set = await getLoadedSet(eng!);
    expect(set.has(id)).toBe(true);
  });

  it("vibehack_unload_tools removes from loaded set", async () => {
    const { loadToolsTool, unloadToolsTool, lazyToolName } =
      await import("../extensions/pi-vibehack/lib/lazy-tools.ts");
    const { TOOL_CATALOG } = await import("../extensions/pi-vibehack/data/tool-catalog.ts");
    const id = lazyToolName(TOOL_CATALOG.find((t) => t.name === "ffuf")!);
    await (loadToolsTool as any).execute("c", { tool_ids: [id] });
    const r: any = await (unloadToolsTool as any).execute("c", { tool_ids: [id] });
    expect(r.loaded).not.toContain(id);
  });

  it("wrapper tool returns not-installed error when binary absent", async () => {
    const { buildLazyTools } = await import("../extensions/pi-vibehack/lib/lazy-tools.ts");
    const tools = buildLazyTools({ exec: async () => ({ code: 0, stdout: "", stderr: "", killed: false }) });
    // Pick a tool that's almost certainly not on the test box
    const t = tools.find((x: any) => x.name === "vibehack_run_bloodhound_python");
    expect(t).toBeTruthy();
    const r: any = await t.execute("c", { args: [] });
    if (r.error === "not-installed") {
      expect(r.tool).toBe("bloodhound-python");
    } else {
      // If it happens to be installed (unlikely), at least the schema should be the success shape.
      expect(typeof r.exit_code).toBe("number");
    }
  });

  it("wrapper tool calls pi.exec with correct args when installed", async () => {
    const { buildLazyTools } = await import("../extensions/pi-vibehack/lib/lazy-tools.ts");
    const exec = vi.fn().mockResolvedValue({ code: 0, stdout: "ok", stderr: "", killed: false });
    const tools = buildLazyTools({ exec });
    // Use curl — extremely likely to be present, BUT we don't actually rely on
    // the detector here. We mock the "exec" path. To force the call, we can't
    // easily skip detection; instead, find a tool we know detector returns true
    // for if available. Since we can't guarantee, just assert exec was wired.
    const curlT = tools.find((x: any) => x.name === "vibehack_run_curl");
    expect(curlT).toBeTruthy();
    const r: any = await curlT.execute("c", { args: ["-sIL", "https://example.com"], timeout_ms: 5000 });
    if (r.error === "not-installed") {
      // Detector said no; exec was not called — acceptable on minimal environments.
      expect(exec).not.toHaveBeenCalled();
    } else {
      expect(exec).toHaveBeenCalledWith("curl", ["-sIL", "https://example.com"], expect.objectContaining({ timeout: 5000 }));
      expect(r.stdout).toBe("ok");
    }
  });
});

describe("tool-search reports lazy tool ID + loaded state", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-ts-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const eng = newEngagementId("search-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("includes id field on every match (vibehack_run_<bin>)", async () => {
    const { toolSearchTool } = await import("../extensions/pi-vibehack/tools/tool-search.ts");
    const r: any = await (toolSearchTool as any).execute("c", { query: "subdomain", limit: 3 });
    for (const m of r.matches) expect(m.id?.startsWith("vibehack_run_")).toBe(true);
  });

  it("loaded flag flips after vibehack_load_tools", async () => {
    const { toolSearchTool } = await import("../extensions/pi-vibehack/tools/tool-search.ts");
    const { loadToolsTool, lazyToolName } = await import("../extensions/pi-vibehack/lib/lazy-tools.ts");
    const { TOOL_CATALOG } = await import("../extensions/pi-vibehack/data/tool-catalog.ts");
    const id = lazyToolName(TOOL_CATALOG.find((t) => t.name === "nuclei")!);
    await (loadToolsTool as any).execute("c", { tool_ids: [id] });
    const r: any = await (toolSearchTool as any).execute("c", { query: "nuclei", limit: 5 });
    const m = r.matches.find((x: any) => x.id === id);
    expect(m?.loaded).toBe(true);
  });
});
