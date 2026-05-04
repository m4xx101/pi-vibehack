import { describe, it, expect } from "vitest";
import { confirmTool } from "../extensions/pi-vibehack/tools/confirm.ts";

describe("vibehack_confirm prepareArguments", () => {
  it("renames camelCase aliases to snake_case", () => {
    const out = confirmTool.prepareArguments!({
      nodeId: "n1",
      pocSummary: "got shell",
      evidenceRefs: ["e1", "e2"],
    });
    expect(out).toMatchObject({
      node_id: "n1",
      poc_summary: "got shell",
      evidence_refs: ["e1", "e2"],
    });
  });

  it("accepts id as node_id", () => {
    const out = confirmTool.prepareArguments!({ id: "n1", poc_summary: "x", evidence_refs: [] });
    expect((out as any).node_id).toBe("n1");
  });

  it("passes correct args through", () => {
    const args = { node_id: "n1", poc_summary: "x", evidence_refs: ["a"] };
    const out = confirmTool.prepareArguments!(args);
    expect(out).toMatchObject(args);
  });
});
