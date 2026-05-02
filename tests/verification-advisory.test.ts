import { describe, it, expect } from "vitest";
import { buildVerificationAdvisory } from "../extensions/pi-vibehack/hooks/before-agent-start.ts";

describe("buildVerificationAdvisory", () => {
  it("injects when confirm event has browser-class kind without prior verification_pass", () => {
    const events = [
      { event: "confirm", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", ts: "2026-05-02T10:00:00.000Z" },
    ];
    const block = buildVerificationAdvisory(events);
    expect(block).toContain("<verification_advisory>");
    expect(block).toContain("n1");
    expect(block).toContain("DOM-XSS");
    expect(block).toContain("propose_specialist");
    expect(block).toContain("browser-verifier");
    expect(block).toContain("</verification_advisory>");
  });

  it("does NOT inject for non-browser-class confirms", () => {
    const events = [
      { event: "confirm", engagement_id: "eng-1", node_id: "n2", kind: "SQLi", ts: "2026-05-02T10:00:00.000Z" },
    ];
    expect(buildVerificationAdvisory(events)).toBe("");
  });

  it("does NOT inject when verification_pass event exists for the same node_id", () => {
    const events = [
      { event: "confirm", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", ts: "2026-05-02T10:00:00.000Z" },
      { event: "verification_pass", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", verifier: "browser-verifier", evidence_ref: "poc/n1/verification.png", ts: "2026-05-02T10:00:01.000Z" },
    ];
    expect(buildVerificationAdvisory(events)).toBe("");
  });

  it("recognizes all 7 browser-class kinds", () => {
    const kinds = ["DOM-XSS", "reflected-XSS", "stored-XSS", "open-redirect", "clickjacking", "postMessage-leak", "subdomain-takeover"];
    for (const k of kinds) {
      const events = [{ event: "confirm", engagement_id: "eng-1", node_id: "n1", kind: k, ts: "2026-05-02T10:00:00.000Z" }];
      const block = buildVerificationAdvisory(events);
      expect(block).toContain(k);
    }
  });

  it("aggregates multiple unverified browser confirms into one advisory block", () => {
    const events = [
      { event: "confirm", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", ts: "2026-05-02T10:00:00.000Z" },
      { event: "confirm", engagement_id: "eng-1", node_id: "n2", kind: "open-redirect", ts: "2026-05-02T10:00:01.000Z" },
    ];
    const block = buildVerificationAdvisory(events);
    expect(block).toContain("n1");
    expect(block).toContain("n2");
    expect(block).toContain("DOM-XSS");
    expect(block).toContain("open-redirect");
    expect(block.match(/<verification_advisory>/g)?.length).toBe(1);
  });

  it("handles empty events array", () => {
    expect(buildVerificationAdvisory([])).toBe("");
  });

  it("filters out non-confirm events", () => {
    const events = [
      { event: "node_add", engagement_id: "eng-1", node_id: "n1", kind: "DOM-XSS", ts: "2026-05-02T10:00:00.000Z" },
    ];
    expect(buildVerificationAdvisory(events)).toBe("");
  });
});
