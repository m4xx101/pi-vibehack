import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expandTool } from "../extensions/pi-vibehack/tools/expand.ts";
import { pruneTool } from "../extensions/pi-vibehack/tools/prune.ts";
import { confirmTool } from "../extensions/pi-vibehack/tools/confirm.ts";
import { evidenceTool } from "../extensions/pi-vibehack/tools/evidence.ts";
import { deadEndTool } from "../extensions/pi-vibehack/tools/dead-end.ts";
import { proposeChainTool } from "../extensions/pi-vibehack/tools/propose-chain.ts";
import { proposeSpecialistTool } from "../extensions/pi-vibehack/tools/propose-specialist.ts";
import { HYPOTHESIS_MUTATING_TOOLS, PROPOSAL_TOOLS, PLANNER_TOOL_NAMES } from "../extensions/pi-vibehack/tools/index.ts";
import { readEvents } from "../extensions/pi-vibehack/lib/events.ts";
import { engagementDir, setActiveEngagement, slugify, newEngagementId } from "../extensions/pi-vibehack/lib/engagement.ts";

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

describe("vibehack_confirm", () => {
  it("appends a confirm event with rationale + evidence_refs metadata", async () => {
    await confirmTool.execute("c", { node_id: "n_2a", poc_summary: "RCE confirmed", evidence_refs: ["evidence/x.txt"] } as any, undefined, undefined, fakeCtx);
    const events = await readEvents(engagementDir("e1"));
    expect(events[0].event).toBe("confirm");
    expect(events[0].rationale).toBe("RCE confirmed");
    expect((events[0] as any).metadata.evidence_refs).toEqual(["evidence/x.txt"]);
  });
});

describe("vibehack_evidence", () => {
  it("appends an evidence_add event with one evidence entry", async () => {
    await evidenceTool.execute("c", { node_id: "n_1a", kind: "http_replay", ref: "evidence/r.json", summary: "200 OK" } as any, undefined, undefined, fakeCtx);
    const events = await readEvents(engagementDir("e1"));
    expect(events[0].event).toBe("evidence_add");
    expect(events[0].evidence?.length).toBe(1);
    expect(events[0].evidence?.[0].kind).toBe("http_replay");
  });
});

describe("vibehack_dead_end", () => {
  it("appends a node_update with status=dead and reason", async () => {
    await deadEndTool.execute("c", { node_id: "n_1a", reason: "stack-only, no userland reach" } as any, undefined, undefined, fakeCtx);
    const events = await readEvents(engagementDir("e1"));
    expect(events[0].event).toBe("node_update");
    expect(events[0].status).toBe("dead");
    expect(events[0].rationale).toBe("stack-only, no userland reach");
  });
});

describe("vibehack_propose_chain", () => {
  it("appends a chain_propose event with steps + is_destructive metadata", async () => {
    await proposeChainTool.execute("c", {
      root_node_id: "n_3b",
      steps: [
        { node_id: "n_4a", next_test: "lateral", expected_outcome: "shell on host2" },
      ],
      rationale: "post-RCE pivot",
      is_destructive: true,
    } as any, undefined, undefined, fakeCtx);
    const events = await readEvents(engagementDir("e1"));
    expect(events[0].event).toBe("chain_propose");
    expect((events[0] as any).metadata.is_destructive).toBe(true);
    expect((events[0] as any).metadata.steps.length).toBe(1);
  });
});

describe("vibehack_propose_specialist", () => {
  it("appends a specialist_propose event with kind in metadata", async () => {
    await proposeSpecialistTool.execute("c", { node_id: "n_2a", specialist_kind: "web-exploit", rationale: "Java deser surface" } as any, undefined, undefined, fakeCtx);
    const events = await readEvents(engagementDir("e1"));
    expect(events[0].event).toBe("specialist_propose");
    expect((events[0] as any).metadata.specialist_kind).toBe("web-exploit");
  });
});

describe("active-engagement guard", () => {
  it("expand throws when no active engagement", async () => {
    await setActiveEngagement(null);
    await expect(expandTool.execute("c", { parent_id: null, kind: "root", phase: "recon", claim: "x", next_test: "", falsifier: "n/a", rationale: "" } as any, undefined, undefined, fakeCtx))
      .rejects.toThrow(/no active engagement/);
  });
});

describe("HYPOTHESIS_MUTATING_TOOLS / PROPOSAL_TOOLS partitioning", () => {
  it("mutation set contains exactly the 5 state-mutating tools", () => {
    expect(HYPOTHESIS_MUTATING_TOOLS.size).toBe(5);
    expect([...HYPOTHESIS_MUTATING_TOOLS].sort()).toEqual([
      "vibehack_confirm", "vibehack_dead_end", "vibehack_evidence", "vibehack_expand", "vibehack_prune",
    ]);
  });

  it("proposal set contains exactly the 2 operator-gated proposal tools", () => {
    expect(PROPOSAL_TOOLS.size).toBe(2);
    expect([...PROPOSAL_TOOLS].sort()).toEqual(["vibehack_propose_chain", "vibehack_propose_specialist"]);
  });

  it("mutation and proposal sets do not overlap", () => {
    for (const m of HYPOTHESIS_MUTATING_TOOLS) expect(PROPOSAL_TOOLS.has(m)).toBe(false);
  });

  it("PLANNER_TOOL_NAMES is the union plus the recall forward-reference", () => {
    expect(PLANNER_TOOL_NAMES.length).toBe(8);
    expect(PLANNER_TOOL_NAMES).toContain("vibehack_recall");
  });
});

describe("slugify + newEngagementId edge cases", () => {
  it("folds Unicode diacritics", () => {
    expect(slugify("café-target")).toBe("cafe-target");
  });

  it("returns 'untargeted' on empty / all-symbol input", () => {
    expect(slugify("")).toBe("untargeted");
    expect(slugify("???")).toBe("untargeted");
    expect(slugify("---")).toBe("untargeted");
  });

  it("trims trailing hyphen after 60-char truncation", () => {
    const s = slugify("a".repeat(58) + "-bb");
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith("-")).toBe(false);
  });

  it("newEngagementId never ends with bare hyphen on empty input", () => {
    const id = newEngagementId("");
    expect(id).toMatch(/-untargeted$/);
  });
});
