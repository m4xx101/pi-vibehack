import { describe, it, expect } from "vitest";
import {
  pickOpenHypothesisQuery,
  formatRecallBlock,
} from "../extensions/pi-vibehack/hooks/before-provider-request.ts";
import type { VibehackEvent } from "../extensions/pi-vibehack/lib/event-schema.ts";

const ev = (over: Partial<VibehackEvent>): VibehackEvent => ({
  ts: "2026-04-29T10:00:00Z",
  engagement_id: "e1",
  event: "node_add",
  node_id: "n_root",
  parent_id: null,
  kind: "root",
  phase: "recon",
  claim: "root",
  next_test: "",
  falsifier: "",
  confidence: 1,
  status: "open",
  requires_browser: false,
  evidence: [],
  cost_tokens: 0,
  cost_usd: 0,
  rationale: "",
  metadata: {},
  ...over,
} as VibehackEvent);

describe("pickOpenHypothesisQuery", () => {
  it("returns null on empty", () => {
    expect(pickOpenHypothesisQuery([])).toBeNull();
  });

  it("prefers leaf > hypothesis even with lower confidence", () => {
    const events = [
      ev({ node_id: "n_root", parent_id: null, kind: "root", claim: "root", confidence: 1 }),
      ev({ node_id: "n_1a", parent_id: "n_root", kind: "hypothesis", claim: "hypothesis claim", confidence: 0.9, status: "open" }),
      ev({ node_id: "n_1b", parent_id: "n_root", kind: "leaf", claim: "leaf claim", confidence: 0.3, status: "open" }),
    ];
    expect(pickOpenHypothesisQuery(events)).toBe("leaf claim");
  });
});

describe("formatRecallBlock", () => {
  it("returns empty string for no subgraphs", () => {
    expect(formatRecallBlock([])).toBe("");
  });

  it("emits a <recall> block containing notes", () => {
    const block = formatRecallBlock([
      { source: "fallback-grep", entities: [], edges: [], notes: ["jboss default creds"] },
    ]);
    expect(block).toContain("<recall>");
    expect(block).toContain("</recall>");
    expect(block).toContain("jboss default creds");
  });
});
