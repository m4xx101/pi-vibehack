import { describe, it, expect } from "vitest";
import { pruneTool } from "../extensions/pi-vibehack/tools/prune.ts";

describe("vibehack_prune prepareArguments", () => {
  it("renames nodeId → node_id", () => {
    const out = pruneTool.prepareArguments!({ nodeId: "n1", reason: "no signal" });
    expect(out).toMatchObject({ node_id: "n1", reason: "no signal" });
  });

  it("accepts bare id as node_id", () => {
    const out = pruneTool.prepareArguments!({ id: "n1", reason: "x" });
    expect(out).toMatchObject({ node_id: "n1", reason: "x" });
  });

  it("passes correct args through", () => {
    const out = pruneTool.prepareArguments!({ node_id: "n1", reason: "x" });
    expect(out).toMatchObject({ node_id: "n1", reason: "x" });
  });

  it("trims string fields", () => {
    const out = pruneTool.prepareArguments!({ nodeId: "  n1  ", reason: " r " });
    expect((out as any).node_id).toBe("n1");
    expect((out as any).reason).toBe("r");
  });
});
