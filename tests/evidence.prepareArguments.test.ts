import { describe, it, expect } from "vitest";
import { evidenceTool } from "../extensions/pi-vibehack/tools/evidence.ts";

describe("vibehack_evidence prepareArguments", () => {
  it("renames camelCase nodeId → node_id", () => {
    const out = evidenceTool.prepareArguments!({
      nodeId: "n1",
      kind: "screenshot",
      ref: "/tmp/a.png",
      summary: "200 OK",
    });
    expect(out).toMatchObject({
      node_id: "n1",
      kind: "screenshot",
      ref: "/tmp/a.png",
      summary: "200 OK",
    });
  });

  it("accepts evidenceType as kind alias", () => {
    const out = evidenceTool.prepareArguments!({
      node_id: "n1",
      evidenceType: "log",
      ref: "x",
      summary: "y",
    });
    expect((out as any).kind).toBe("log");
  });

  it("passes correct args through", () => {
    const args = { node_id: "n1", kind: "log", ref: "x", summary: "y" };
    const out = evidenceTool.prepareArguments!(args);
    expect(out).toMatchObject(args);
  });
});
