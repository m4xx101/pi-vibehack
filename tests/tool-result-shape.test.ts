// v1.4.3 regression — every tool's execute() return value must be in
// pi-mono's documented {content:[{type:"text",text:string}], details?:any}
// shape (render-utils.d.ts:7). Pre-1.4.3 plain-object returns crashed
// pi-mono's render-utils.js:30: "Cannot read properties of undefined".

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ok, err, ensureToolResult, wrapToolResult } from "../extensions/pi-vibehack/lib/tool-result.ts";

describe("tool-result helpers", () => {
  it("ok() wraps an object into {content:[{type:'text',text}], details}", () => {
    const r = ok({ matches: [{ id: "vibehack_run_nuclei" }], total: 1 });
    expect(Array.isArray(r.content)).toBe(true);
    expect(r.content[0].type).toBe("text");
    expect(typeof r.content[0].text).toBe("string");
    expect(r.details).toEqual({ matches: [{ id: "vibehack_run_nuclei" }], total: 1 });
  });

  it("ok() wraps a string into a single-block result without details", () => {
    const r = ok("plain text");
    expect(r.content[0].text).toBe("plain text");
    expect(r.details).toBeUndefined();
  });

  it("err() produces isError + Error: prefix", () => {
    const r = err("bad input", { code: 422 });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/^Error: bad input/);
    expect(r.details).toEqual({ code: 422 });
  });

  it("ensureToolResult passes through already-shaped results", () => {
    const shaped = { content: [{ type: "text", text: "hi" }], details: { x: 1 } };
    const r = ensureToolResult(shaped);
    expect(r).toBe(shaped); // identity
  });

  it("ensureToolResult maps {error:'...'} to err()", () => {
    const r = ensureToolResult({ error: "no-chrome-attached", hint: "..." });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/Error: no-chrome-attached/);
  });

  it("wrapToolResult is idempotent", () => {
    const tool = { name: "x", execute: async () => ({ foo: 1 }) };
    const w1 = wrapToolResult(tool);
    const w2 = wrapToolResult(w1);
    expect(w2).toBe(w1);
  });

  it("wrapToolResult catches throws and returns isError", async () => {
    const tool = { name: "boom", execute: async () => { throw new Error("kaboom"); } };
    const w = wrapToolResult(tool);
    const r: any = await w.execute("c", {});
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/tool boom threw: kaboom/);
  });
});

describe("v1.4.3 — every always-active tool returns pi-mono shape after wrapping", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-shape-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const eng = newEngagementId("shape-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("vibehack_tool_search wrapped result has content array", async () => {
    const { toolSearchTool } = await import("../extensions/pi-vibehack/tools/tool-search.ts");
    const w = wrapToolResult(toolSearchTool as any);
    const r: any = await (w as any).execute("c", { query: "subdomain", limit: 3 });
    expect(Array.isArray(r.content)).toBe(true);
    expect(r.content[0].type).toBe("text");
    expect(r.details?.matches).toBeDefined();
  });

  it("vibehack_browser_verify wrapped error result has content array", async () => {
    const { browserVerifyTool } = await import("../extensions/pi-vibehack/tools/browser-verify.ts");
    const w = wrapToolResult(browserVerifyTool as any);
    const r: any = await (w as any).execute("c", {
      url: "http://example.com", port: 59999, timeout_ms: 1500,
    });
    expect(Array.isArray(r.content)).toBe(true);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/no-chrome-attached/);
  });

  it("vibehack_load_tools wrapped result has content array", async () => {
    const { loadToolsTool, lazyToolName } = await import("../extensions/pi-vibehack/lib/lazy-tools.ts");
    const { TOOL_CATALOG } = await import("../extensions/pi-vibehack/data/tool-catalog.ts");
    const id = lazyToolName(TOOL_CATALOG[0]);
    const w = wrapToolResult(loadToolsTool as any);
    const r: any = await (w as any).execute("c", { tool_ids: [id] });
    expect(Array.isArray(r.content)).toBe(true);
    expect(r.details?.loaded).toContain(id);
  });

  it("buildLazyTools wrapper not-installed result has content array", async () => {
    const { buildLazyTools } = await import("../extensions/pi-vibehack/lib/lazy-tools.ts");
    const tools = buildLazyTools({ exec: async () => ({ code: 0, stdout: "", stderr: "", killed: false }) });
    const t = tools.find((x: any) => x.name === "vibehack_run_bloodhound_python");
    const w = wrapToolResult(t as any);
    const r: any = await (w as any).execute("c", { args: [] });
    expect(Array.isArray(r.content)).toBe(true);
    expect(r.content[0].type).toBe("text");
    // Whether installed or not, the shape is always valid
  });
});
