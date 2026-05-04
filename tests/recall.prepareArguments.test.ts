import { describe, it, expect } from "vitest";
import { recallTool } from "../extensions/pi-vibehack/tools/recall.ts";

describe("vibehack_recall prepareArguments", () => {
  it("passes correct args through", () => {
    const out = recallTool.prepareArguments!({ query: "ssrf" });
    expect(out).toMatchObject({ query: "ssrf" });
  });

  it("renames q → query alias", () => {
    const out = recallTool.prepareArguments!({ q: "xss" });
    expect((out as any).query).toBe("xss");
  });

  it("trims whitespace on query", () => {
    const out = recallTool.prepareArguments!({ query: "  open redirect  " });
    expect((out as any).query).toBe("open redirect");
  });
});
