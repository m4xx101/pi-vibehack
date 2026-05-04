import { describe, it, expect } from "vitest";
import { proposeChainTool } from "../extensions/pi-vibehack/tools/propose-chain.ts";

describe("vibehack_propose_chain prepareArguments", () => {
  it("renames camelCase aliases (top-level + nested step items)", () => {
    const out = proposeChainTool.prepareArguments!({
      rootNodeId: "n1",
      steps: [
        { nodeId: "n2", nextTest: "do x", expectedOutcome: "y" },
        { node_id: "n3", next_test: "z", expected_outcome: "w" },
      ],
      rationale: "chain",
      isDestructive: true,
    });
    expect(out).toMatchObject({
      root_node_id: "n1",
      rationale: "chain",
      is_destructive: true,
    });
    expect((out as any).steps).toEqual([
      { node_id: "n2", next_test: "do x", expected_outcome: "y" },
      { node_id: "n3", next_test: "z", expected_outcome: "w" },
    ]);
  });

  it("passes correct args through", () => {
    const args = {
      root_node_id: "n1",
      steps: [{ node_id: "n2", next_test: "x", expected_outcome: "y" }],
      rationale: "r",
      is_destructive: false,
    };
    const out = proposeChainTool.prepareArguments!(args);
    expect(out).toMatchObject(args);
  });
});
