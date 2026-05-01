import { describe, it, expect, beforeEach } from "vitest";
import { startTurn, recordToolCall } from "../extensions/pi-vibehack/lib/turn-state.ts";
import { getMutationGateMessage } from "../extensions/pi-vibehack/hooks/tool-result.ts";

describe("hypothesis-or-die invariant", () => {
  beforeEach(() => startTurn("t1"));

  it("returns gate message when no mutation occurred", () => {
    recordToolCall("read");
    expect(getMutationGateMessage()).toMatch(/no tree mutation/);
  });

  it("returns null when a mutation tool was called", () => {
    recordToolCall("vibehack_expand");
    expect(getMutationGateMessage()).toBeNull();
  });

  it("evidence_add counts as a mutation", () => {
    recordToolCall("vibehack_evidence");
    expect(getMutationGateMessage()).toBeNull();
  });

  it("dead_end is a clean escape", () => {
    recordToolCall("vibehack_dead_end");
    expect(getMutationGateMessage()).toBeNull();
  });

  it("proposals do NOT satisfy the invariant (deviation #2)", () => {
    // vibehack_propose_chain stages an operator-gated change; it does not
    // advance the tree on its own. The hypothesis-or-die gate must still fire.
    recordToolCall("vibehack_propose_chain");
    expect(getMutationGateMessage()).toMatch(/no tree mutation/);
  });

  it("gate message escape list excludes proposal tools (anti-loop)", () => {
    // The gate must NOT advertise propose_chain/propose_specialist as escapes —
    // those are ALSO listed in turn-state's mutation set check, but the
    // recordToolCall test above proves they don't flip mutated=true. If the
    // gate listed them, the agent would emit one and get gated again.
    recordToolCall("read");
    const msg = getMutationGateMessage()!;
    // Escape list (between "Emit one of:" and "if genuinely stuck") must not
    // contain propose_*. Use a positive check: exactly the 5 mutating tools.
    const escapeList = msg.split("Emit one of:")[1].split("if genuinely stuck")[0];
    expect(escapeList).toContain("vibehack_expand");
    expect(escapeList).toContain("vibehack_prune");
    expect(escapeList).toContain("vibehack_confirm");
    expect(escapeList).toContain("vibehack_evidence");
    expect(escapeList).toContain("vibehack_dead_end");
    expect(escapeList).not.toMatch(/vibehack_propose_chain[,\s]/);
    expect(escapeList).not.toMatch(/vibehack_propose_specialist[,\s]/);
  });
});
