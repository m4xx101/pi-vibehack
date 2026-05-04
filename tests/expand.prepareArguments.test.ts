import { describe, it, expect } from "vitest";
import { expandTool } from "../extensions/pi-vibehack/tools/expand.ts";

describe("vibehack_expand prepareArguments", () => {
  it("renames camelCase aliases to snake_case", () => {
    const out = expandTool.prepareArguments!({
      parentId: "n1",
      kind: "hypothesis",
      phase: "recon",
      claim: "x",
      nextTest: "do thing",
      falsifier: "fails if y",
      requiresBrowser: true,
      rationale: "because",
    });
    expect(out).toMatchObject({
      parent_id: "n1",
      kind: "hypothesis",
      phase: "recon",
      claim: "x",
      next_test: "do thing",
      falsifier: "fails if y",
      requires_browser: true,
      rationale: "because",
    });
  });

  it("passes already-correct snake_case args through", () => {
    const args = {
      parent_id: null,
      kind: "root",
      phase: "recon",
      claim: "engagement: target",
      next_test: "",
      falsifier: "n/a",
      rationale: "boot",
    };
    const out = expandTool.prepareArguments!(args);
    expect(out).toMatchObject(args);
  });

  it("preserves null parent_id (no coerce to string)", () => {
    const out = expandTool.prepareArguments!({
      parentId: null,
      kind: "root",
      phase: "recon",
      claim: "x",
      nextTest: "",
      falsifier: "n/a",
      rationale: "r",
    });
    expect((out as any).parent_id).toBeNull();
  });

  it("trims string fields", () => {
    const out = expandTool.prepareArguments!({
      parent_id: "n1",
      kind: "hypothesis",
      phase: "recon",
      claim: "  spaced claim  ",
      next_test: " test ",
      falsifier: " fals ",
      rationale: " r ",
    });
    expect((out as any).claim).toBe("spaced claim");
    expect((out as any).next_test).toBe("test");
  });

  it("returns original args defensively if shim throws", () => {
    // null input — shim returns it unchanged via safePrepare or normalizeArgs guard.
    const out = expandTool.prepareArguments!(null as any);
    expect(out).toBeNull();
  });
});
