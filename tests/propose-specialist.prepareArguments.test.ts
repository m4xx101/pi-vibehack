import { describe, it, expect } from "vitest";
import { proposeSpecialistTool } from "../extensions/pi-vibehack/tools/propose-specialist.ts";

describe("vibehack_propose_specialist prepareArguments", () => {
  it("renames nodeId/specialistKind to snake_case", () => {
    const out = proposeSpecialistTool.prepareArguments!({
      nodeId: "n1",
      specialistKind: "web-recon",
      rationale: "r",
    });
    expect(out).toMatchObject({
      node_id: "n1",
      specialist_kind: "web-recon",
      rationale: "r",
    });
  });

  it("passes correct args through", () => {
    const args = { node_id: "n1", specialist_kind: "osint", rationale: "r" };
    const out = proposeSpecialistTool.prepareArguments!(args);
    expect(out).toMatchObject(args);
  });
});
