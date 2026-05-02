import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { EventSchema } from "../extensions/pi-vibehack/lib/event-schema.ts";

describe("v1.1 event types", () => {
  describe("verification_pass", () => {
    it("validates a canonical verification_pass event", () => {
      const e = {
        event: "verification_pass",
        engagement_id: "eng-1",
        node_id: "n1",
        kind: "DOM-XSS",
        verifier: "browser-verifier",
        evidence_ref: "poc/n1/verification.png",
        ts: "2026-05-02T10:00:00.000Z",
      };
      expect(Value.Check(EventSchema, e)).toBe(true);
    });
    it("rejects missing evidence_ref", () => {
      const e = { event: "verification_pass", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", verifier: "browser-verifier", ts: "2026-05-02T10:00:00.000Z" };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
    it("rejects bare-date timestamp (strict ISO 8601 with TZ)", () => {
      const e = { event: "verification_pass", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", verifier: "x", evidence_ref: "y", ts: "2026-05-02" };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
    it("rejects timestamp without timezone", () => {
      const e = { event: "verification_pass", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", verifier: "x", evidence_ref: "y", ts: "2026-05-02T10:00:00" };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
    it("rejects extra properties (additionalProperties: false)", () => {
      const e = {
        event: "verification_pass",
        engagement_id: "eng-1",
        node_id: "n1", kind: "DOM-XSS", verifier: "x", evidence_ref: "y",
        ts: "2026-05-02T10:00:00.000Z",
        extraneous: "boom",
      };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
    it("rejects verification_pass missing engagement_id", () => {
      const e = {
        event: "verification_pass",
        node_id: "n1", kind: "DOM-XSS", verifier: "x", evidence_ref: "y",
        ts: "2026-05-02T10:00:00.000Z",
      };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
  });

  describe("verification_fail", () => {
    it("validates with reason field", () => {
      const e = {
        event: "verification_fail",
        engagement_id: "eng-1",
        node_id: "n1",
        kind: "DOM-XSS",
        verifier: "browser-verifier",
        reason: "no alert dialog observed",
        ts: "2026-05-02T10:00:00.000Z",
      };
      expect(Value.Check(EventSchema, e)).toBe(true);
    });
    it("rejects missing reason", () => {
      const e = { event: "verification_fail", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", verifier: "x", ts: "2026-05-02T10:00:00.000Z" };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
    it("rejects extras", () => {
      const e = { event: "verification_fail", engagement_id: "eng-1", node_id: "n1", kind: "x", verifier: "x", reason: "x", ts: "2026-05-02T10:00:00.000Z", extra: "boom" };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
  });

  describe("verification_advisory", () => {
    it("validates with message field", () => {
      const e = {
        event: "verification_advisory",
        engagement_id: "eng-1",
        node_id: "n1",
        kind: "DOM-XSS",
        message: "browser verification recommended",
        ts: "2026-05-02T10:00:00.000Z",
      };
      expect(Value.Check(EventSchema, e)).toBe(true);
    });
    it("rejects missing message", () => {
      const e = { event: "verification_advisory", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", ts: "2026-05-02T10:00:00.000Z" };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
  });

  describe("canary_planted", () => {
    it("validates filesystem canary", () => {
      const e = {
        event: "canary_planted",
        engagement_id: "eng-1",
        node_id: "n1",
        canary_kind: "filesystem",
        uuid: "abc-123-uuid",
        ref: "evidence/canary-abc-123.txt",
        ts: "2026-05-02T10:00:00.000Z",
      };
      expect(Value.Check(EventSchema, e)).toBe(true);
    });

    it("validates http-callback canary with optional callback_url", () => {
      const e = {
        event: "canary_planted",
        engagement_id: "eng-1",
        node_id: "n1",
        canary_kind: "http-callback",
        uuid: "abc-123",
        ref: "http://127.0.0.1:9999/abc-123",
        callback_url: "http://127.0.0.1:9999/abc-123",
        ts: "2026-05-02T10:00:00.000Z",
      };
      expect(Value.Check(EventSchema, e)).toBe(true);
    });

    it("validates dns canary kind", () => {
      const e = { event: "canary_planted", engagement_id: "eng-1", node_id: "n1", canary_kind: "dns", uuid: "abc", ref: "abc.collector.example", ts: "2026-05-02T10:00:00.000Z" };
      expect(Value.Check(EventSchema, e)).toBe(true);
    });

    it("validates blind-oob canary kind", () => {
      const e = { event: "canary_planted", engagement_id: "eng-1", node_id: "n1", canary_kind: "blind-oob", uuid: "abc", ref: "x", ts: "2026-05-02T10:00:00.000Z" };
      expect(Value.Check(EventSchema, e)).toBe(true);
    });

    it("rejects unknown canary_kind", () => {
      const e = { event: "canary_planted", engagement_id: "eng-1", node_id: "n1", canary_kind: "magic-mode", uuid: "abc", ref: "x", ts: "2026-05-02T10:00:00.000Z" };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });

    it("rejects extras", () => {
      const e = { event: "canary_planted", engagement_id: "eng-1", node_id: "n1", canary_kind: "filesystem", uuid: "abc", ref: "x", ts: "2026-05-02T10:00:00.000Z", extra: "boom" };
      expect(Value.Check(EventSchema, e)).toBe(false);
    });
  });

  describe("backward compatibility", () => {
    it("still validates an existing node_add event", () => {
      const e = {
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
      };
      expect(Value.Check(EventSchema, e)).toBe(true);
    });
  });
});
