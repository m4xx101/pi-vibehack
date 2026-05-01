import { describe, it, expect, beforeEach } from "vitest";
import { pruneStaleRecallRule } from "../extensions/pi-vibehack/dcp-rules/prune-stale-recall.ts";
import {
  pruneFoldedEvidenceRule,
  markCallFolded,
} from "../extensions/pi-vibehack/dcp-rules/prune-folded-evidence.ts";
import {
  pruneDeadBranchesRule,
  markNodeDead,
} from "../extensions/pi-vibehack/dcp-rules/prune-dead-branches.ts";

beforeEach(() => {
  delete (globalThis as any).__vibehack_folded_call_ids;
  delete (globalThis as any).__vibehack_dead_node_ids;
});

describe("prune-stale-recall", () => {
  it("keeps the most recent <recall> block and prunes earlier ones", () => {
    const messages = [
      { role: "system", content: "boot" },
      { role: "system", content: "<recall>old A</recall>" },
      { role: "user", content: "do thing" },
      { role: "system", content: "<recall>old B</recall>" },
      { role: "system", content: "<recall>most recent</recall>" },
    ];
    const prepared = pruneStaleRecallRule.prepare(messages);
    const decisions = prepared.map((m) => pruneStaleRecallRule.decide(m));
    expect(decisions).toEqual(["keep", "prune", "keep", "prune", "keep"]);
    // input not mutated
    expect((messages[1] as any)._vibehack_dcp).toBeUndefined();
  });
});

describe("prune-folded-evidence", () => {
  it("prunes messages whose toolCallId has been marked folded", () => {
    markCallFolded("call-x");
    const messages = [
      { role: "tool", toolCallId: "call-x", content: "folded result" },
      { role: "tool", toolCallId: "call-y", content: "fresh result" },
    ];
    const prepared = pruneFoldedEvidenceRule.prepare(messages);
    const decisions = prepared.map((m) => pruneFoldedEvidenceRule.decide(m));
    expect(decisions).toEqual(["prune", "keep"]);
  });
});

describe("prune-dead-branches", () => {
  it("prunes assistant messages tagged with a dead node_id", () => {
    markNodeDead("n_1a");
    const messages = [
      { role: "assistant", metadata: { node_id: "n_1a" }, content: "exploring n_1a" },
      { role: "assistant", metadata: { node_id: "n_2b" }, content: "exploring n_2b" },
    ];
    const prepared = pruneDeadBranchesRule.prepare(messages);
    const decisions = prepared.map((m) => pruneDeadBranchesRule.decide(m));
    expect(decisions).toEqual(["prune", "keep"]);
  });
});
