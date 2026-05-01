import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { OperatorOutputSchema } from "../extensions/pi-vibehack/lib/operator-output-schema.ts";

const ok = {
  node_id: "n_3a",
  outcome: "confirmed",
  evidence: [{ kind: "http_replay", ref: "evidence/x.json", summary: "200 OK" }],
  confidence: 0.92,
  suggested_next_steps: [],
  handoff_summary: "rce confirmed",
  cost_tokens: 1234,
  cost_usd: 0.04,
};

describe("OperatorOutputSchema", () => {
  it("accepts a valid confirmed result", () => {
    expect(Value.Check(OperatorOutputSchema, ok)).toBe(true);
  });
  it("rejects unknown outcome", () => {
    expect(Value.Check(OperatorOutputSchema, { ...ok, outcome: "weird" })).toBe(false);
  });
  it("accepts blocked-on-auth with scurl_template_request", () => {
    expect(
      Value.Check(OperatorOutputSchema, {
        ...ok,
        outcome: "blocked-on-auth",
        scurl_template_request: { template: "csrf-replay", field_needed: "csrf_token" },
      }),
    ).toBe(true);
  });
  it("rejects unknown additional property at top level", () => {
    expect(Value.Check(OperatorOutputSchema, { ...ok, surprise_field: "nope" })).toBe(false);
  });
});
