import { describe, it, expect } from "vitest";
import { canaryVerifyTool } from "../extensions/pi-vibehack/tools/canary-verify.ts";

describe("vibehack_canary_verify prepareArguments", () => {
  it("renames nodeId → node_id", () => {
    const out = canaryVerifyTool.prepareArguments!({ nodeId: "n1", kind: "RCE" });
    expect(out).toMatchObject({ node_id: "n1", kind: "RCE" });
  });

  it("accepts vulnClass / vulnKind as kind alias", () => {
    const a = canaryVerifyTool.prepareArguments!({ node_id: "n1", vulnClass: "SSRF" });
    expect((a as any).kind).toBe("SSRF");
    const b = canaryVerifyTool.prepareArguments!({ node_id: "n1", vulnKind: "DNS" });
    expect((b as any).kind).toBe("DNS");
  });

  it("passes correct args through", () => {
    const out = canaryVerifyTool.prepareArguments!({ node_id: "n1", kind: "AFR" });
    expect(out).toMatchObject({ node_id: "n1", kind: "AFR" });
  });
});
