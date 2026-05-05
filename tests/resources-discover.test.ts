// resources_discover hook — surface ONLY extra paths (per-engagement prompts,
// global pinned prompts). Bundled prompts are in package.json#pi.prompts and
// must NOT be returned here, otherwise pi-mono logs "[Prompt conflicts]…
// (skipped)" warnings on every boot.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  computeResourcePaths,
  registerResourcesDiscoverHook,
} from "../extensions/pi-vibehack/hooks/resources-discover.ts";

describe("resources_discover handler", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-rd-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("returns empty arrays when no per-engagement / global extras exist", async () => {
    const out = await computeResourcePaths();
    expect(out.skillPaths).toEqual([]);
    expect(out.promptPaths).toEqual([]);
  });

  it("does NOT return the bundled package prompts/ or skills/ directories", async () => {
    // Bundled paths are declared in package.json#pi and must not be re-returned
    // here, otherwise pi-mono logs collision warnings every boot.
    const out = await computeResourcePaths();
    for (const p of out.promptPaths) {
      expect(p.includes("/extensions/") || p.includes("\\extensions\\")).toBe(false);
    }
    for (const p of out.skillPaths) {
      expect(p.includes("/extensions/") || p.includes("\\extensions\\")).toBe(false);
    }
  });

  it("surfaces per-engagement prompts/ directory when present", async () => {
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const eng = newEngagementId("rd-target");
    const dir = engagementDir(eng);
    await fs.mkdir(join(dir, "prompts"), { recursive: true });
    await setActiveEngagement(eng);

    const out = await computeResourcePaths();
    expect(out.promptPaths.some((p: string) => p.endsWith("prompts") && p.includes(eng))).toBe(true);
  });

  it("surfaces global <vibehack-root>/prompts when present", async () => {
    await fs.mkdir(join(tmp, "prompts"), { recursive: true });
    const out = await computeResourcePaths();
    expect(out.promptPaths.some((p: string) => p.startsWith(tmp) && p.endsWith("prompts"))).toBe(true);
  });

  it("registerResourcesDiscoverHook installs a resources_discover handler", async () => {
    const calls: Array<{ event: string }> = [];
    let captured: Function | null = null;
    const fakePi: any = {
      on: (event: string, handler: Function) => {
        calls.push({ event });
        if (event === "resources_discover") captured = handler;
      },
    };
    registerResourcesDiscoverHook(fakePi);
    expect(calls.find((c) => c.event === "resources_discover")).toBeDefined();
    const result = await captured!({}, {});
    expect(Array.isArray(result.skillPaths)).toBe(true);
    expect(Array.isArray(result.promptPaths)).toBe(true);
  });
});
