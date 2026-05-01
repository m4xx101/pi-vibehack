import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expandTool } from "../extensions/pi-vibehack/tools/expand.ts";
import { pruneTool } from "../extensions/pi-vibehack/tools/prune.ts";
import { readEvents } from "../extensions/pi-vibehack/lib/events.ts";
import { engagementDir, setActiveEngagement } from "../extensions/pi-vibehack/lib/engagement.ts";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), "vh-tools-"));
  process.env.VIBEHACK_DATA_DIR = root;
  await setActiveEngagement("e1");
});
afterEach(async () => {
  delete process.env.VIBEHACK_DATA_DIR;
  await fs.rm(root, { recursive: true, force: true });
});

const fakeCtx: any = { ui: { notify: vi.fn() } };

describe("vibehack_expand", () => {
  it("creates a node_add event with required falsifier", async () => {
    const r = await expandTool.execute("call-1", {
      parent_id: null,
      kind: "root",
      phase: "recon",
      claim: "engagement root",
      next_test: "",
      falsifier: "n/a",
      rationale: "starting engagement",
    } as any, undefined, undefined, fakeCtx);
    expect(r.content[0].text).toMatch(/expanded/);
    const events = await readEvents(engagementDir("e1"));
    expect(events.length).toBe(1);
    expect(events[0].event).toBe("node_add");
    expect(events[0].kind).toBe("root");
  });

  it("rejects expand without falsifier when not root", async () => {
    await expect(expandTool.execute("c", {
      parent_id: "n_root",
      kind: "hypothesis",
      phase: "exploit",
      claim: "x",
      next_test: "y",
      falsifier: "",
      rationale: "z",
    } as any, undefined, undefined, fakeCtx)).rejects.toThrow(/falsifier/i);
  });
});

describe("vibehack_prune", () => {
  it("appends a node_prune event", async () => {
    await pruneTool.execute("c", { node_id: "n_1a", reason: "out of scope" } as any, undefined, undefined, fakeCtx);
    const events = await readEvents(engagementDir("e1"));
    expect(events[0].event).toBe("node_prune");
    expect(events[0].rationale).toBe("out of scope");
  });
});
