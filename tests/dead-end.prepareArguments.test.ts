import { describe, it, expect } from "vitest";
import { deadEndTool } from "../extensions/pi-vibehack/tools/dead-end.ts";

describe("vibehack_dead_end prepareArguments", () => {
  it("renames nodeId → node_id", () => {
    const out = deadEndTool.prepareArguments!({ nodeId: "n1", reason: "stuck" });
    expect(out).toMatchObject({ node_id: "n1", reason: "stuck" });
  });

  it("accepts id as node_id", () => {
    const out = deadEndTool.prepareArguments!({ id: "n1", reason: "x" });
    expect((out as any).node_id).toBe("n1");
  });

  it("passes correct args through", () => {
    const out = deadEndTool.prepareArguments!({ node_id: "n1", reason: "x" });
    expect(out).toMatchObject({ node_id: "n1", reason: "x" });
  });
});
