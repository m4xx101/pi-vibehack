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
});
