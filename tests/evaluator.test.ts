import { describe, it, expect } from "vitest";
import { evaluateBench, type ExpectedFindingsFile } from "../extensions/pi-vibehack/lib/evaluator.ts";

describe("evaluator.ts", () => {
  it("passes when all expected findings are present", () => {
    const expected: ExpectedFindingsFile = {
      expected_findings: [{ kind: "SQLi", surface: "/login" }],
      fail_on_missing: ["SQLi"],
      allow_extras: true,
    };
    const actual = [{ kind: "SQLi", surface: "/login" }];
    const result = evaluateBench(expected, actual);
    expect(result.passed).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.matched).toHaveLength(1);
  });

  it("fails when fail_on_missing kind is absent", () => {
    const expected: ExpectedFindingsFile = {
      expected_findings: [{ kind: "SQLi", surface: "/login" }],
      fail_on_missing: ["SQLi"],
      allow_extras: true,
    };
    const result = evaluateBench(expected, []);
    expect(result.passed).toBe(false);
    expect(result.missing).toContain("SQLi");
  });

  it("ignores extras when allow_extras: true", () => {
    const expected: ExpectedFindingsFile = {
      expected_findings: [{ kind: "SQLi" }],
      fail_on_missing: ["SQLi"],
      allow_extras: true,
    };
    const actual = [{ kind: "SQLi" }, { kind: "XSS" }];
    const result = evaluateBench(expected, actual);
    expect(result.passed).toBe(true);
    expect(result.extras).toHaveLength(1);
    expect(result.extras[0].kind).toBe("XSS");
  });

  it("fails on extras when allow_extras: false", () => {
    const expected: ExpectedFindingsFile = {
      expected_findings: [{ kind: "SQLi" }],
      fail_on_missing: [],
      allow_extras: false,
    };
    const actual = [{ kind: "SQLi" }, { kind: "XSS" }];
    expect(evaluateBench(expected, actual).passed).toBe(false);
  });

  it("matches by kind+surface (surface must match if specified in expected)", () => {
    const expected: ExpectedFindingsFile = {
      expected_findings: [{ kind: "SQLi", surface: "/login" }],
      fail_on_missing: ["SQLi"],
      allow_extras: true,
    };
    // Wrong surface — should NOT match
    const actual = [{ kind: "SQLi", surface: "/admin" }];
    const result = evaluateBench(expected, actual);
    expect(result.passed).toBe(false);
    expect(result.missing).toContain("SQLi");
  });

  it("matches by kind alone when expected has no surface", () => {
    const expected: ExpectedFindingsFile = {
      expected_findings: [{ kind: "SQLi" }],  // no surface required
      fail_on_missing: ["SQLi"],
      allow_extras: true,
    };
    const actual = [{ kind: "SQLi", surface: "/anywhere" }];
    expect(evaluateBench(expected, actual).passed).toBe(true);
  });

  it("empty fail_on_missing + allow_extras true = always pass", () => {
    const expected: ExpectedFindingsFile = {
      expected_findings: [],
      fail_on_missing: [],
      allow_extras: true,
    };
    expect(evaluateBench(expected, []).passed).toBe(true);
    expect(evaluateBench(expected, [{ kind: "WHATEVER" }]).passed).toBe(true);
  });

  it("undefined fail_on_missing/allow_extras default sensibly", () => {
    const expected = {
      expected_findings: [{ kind: "SQLi" }],
    } as ExpectedFindingsFile;
    const result = evaluateBench(expected, []);
    expect(result.passed).toBe(true);
  });
});
