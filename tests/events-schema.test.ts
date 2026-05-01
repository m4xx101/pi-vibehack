import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { EventSchema } from "../extensions/pi-vibehack/lib/event-schema.ts";

const baseEvent = {
  ts: "2026-04-29T10:23:45.123Z",
  engagement_id: "2026-04-29-acme-example",
  event: "node_add",
  node_id: "n_3a",
  parent_id: "n_2",
  kind: "hypothesis",
  phase: "exploit",
  claim: "JBoss admin exposed",
  next_test: "GET /jmx-console",
  falsifier: "404",
  confidence: 0.5,
  status: "open",
  requires_browser: false,
  evidence: [],
  cost_tokens: 0,
  cost_usd: 0,
  rationale: "discovered in subdomain enum",
  metadata: {},
};

describe("EventSchema", () => {
  it("accepts a well-formed node_add event", () => {
    expect(Value.Check(EventSchema, baseEvent)).toBe(true);
  });

  it("rejects events missing required fields", () => {
    const bad = { ...baseEvent };
    delete (bad as any).ts;
    expect(Value.Check(EventSchema, bad)).toBe(false);
  });

  it("rejects unknown event types", () => {
    expect(Value.Check(EventSchema, { ...baseEvent, event: "unicorn" })).toBe(false);
  });

  it("accepts root node with parent_id null", () => {
    expect(Value.Check(EventSchema, { ...baseEvent, parent_id: null, kind: "root" })).toBe(true);
  });

  it("accepts a confirm event with evidence array", () => {
    const ev = { ...baseEvent, event: "confirm", status: "confirmed",
      evidence: [{ ts: "2026-04-29T11:00:00Z", kind: "http_replay", ref: "evidence/x.json", summary: "200 OK with shell", synthetic: false }] };
    expect(Value.Check(EventSchema, ev)).toBe(true);
  });

  it("rejects events with unknown additional properties (additionalProperties: false)", () => {
    expect(Value.Check(EventSchema, { ...baseEvent, confidance: 0.9 })).toBe(false);
  });

  it("rejects evidence entries with unknown additional properties", () => {
    const ev = { ...baseEvent, event: "evidence_add",
      evidence: [{ ts: "2026-04-29T11:00:00Z", kind: "x", ref: "y", summary: "z", typo_field: 1 }] };
    expect(Value.Check(EventSchema, ev)).toBe(false);
  });

  it("rejects confidence > 1 and confidence < 0", () => {
    expect(Value.Check(EventSchema, { ...baseEvent, confidence: 1.5 })).toBe(false);
    expect(Value.Check(EventSchema, { ...baseEvent, confidence: -0.1 })).toBe(false);
  });

  it("rejects negative cost_tokens and cost_usd", () => {
    expect(Value.Check(EventSchema, { ...baseEvent, cost_tokens: -1 })).toBe(false);
    expect(Value.Check(EventSchema, { ...baseEvent, cost_usd: -0.01 })).toBe(false);
  });

  it("rejects bare-date and locale-string ts (strict ISO 8601 with timezone)", () => {
    expect(Value.Check(EventSchema, { ...baseEvent, ts: "2026-04-29" })).toBe(false);
    expect(Value.Check(EventSchema, { ...baseEvent, ts: "April 29 2026" })).toBe(false);
    expect(Value.Check(EventSchema, { ...baseEvent, ts: "2026-04-29T10:23:45" })).toBe(false); // missing TZ
  });

  it("accepts ts with explicit numeric timezone offset", () => {
    expect(Value.Check(EventSchema, { ...baseEvent, ts: "2026-04-29T10:23:45+02:00" })).toBe(true);
  });
});
