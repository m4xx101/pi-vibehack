import { describe, it, expect } from "vitest";
import { buildHandoff } from "../extensions/pi-vibehack/lib/handoff.ts";
import type { OperatorOutput } from "../extensions/pi-vibehack/lib/operator-output-schema.ts";

const baseInconclusive: OperatorOutput = {
  node_id: "n_4b",
  outcome: "inconclusive",
  evidence: [
    { kind: "http_replay", ref: "evidence/req-1.json", summary: "302 redirect to /login" },
  ],
  confidence: 0.42,
  suggested_next_steps: [
    {
      claim: "endpoint requires authenticated session",
      next_test: "replay with session cookie",
      falsifier: "still 302 with valid cookie",
    },
  ],
  handoff_summary: "auth boundary hit; session cookie likely needed",
  cost_tokens: 800,
  cost_usd: 0.02,
};

describe("buildHandoff", () => {
  it("inconclusive outcome includes handoff_summary and first next-step claim", () => {
    const s = buildHandoff(baseInconclusive);
    expect(s).toContain("auth boundary hit; session cookie likely needed");
    expect(s).toContain("endpoint requires authenticated session");
  });

  it("confirmed outcome returns empty string", () => {
    const confirmed: OperatorOutput = {
      ...baseInconclusive,
      outcome: "confirmed",
      confidence: 0.95,
    };
    expect(buildHandoff(confirmed)).toBe("");
  });

  it("inconclusive outcome string contains 'falsifier' (case-insensitive)", () => {
    const s = buildHandoff(baseInconclusive);
    expect(s.toLowerCase()).toContain("falsifier");
  });
});
