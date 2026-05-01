import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventSchema } from "../extensions/pi-vibehack/lib/event-schema.ts";
import { appendEvent, readEvents, nowIso, newNodeId } from "../extensions/pi-vibehack/lib/events.ts";

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

describe("event append/read", () => {
  it("appends and reads back events", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "vh-ev-"));
    const ev = { ...baseEvent, ts: nowIso() };
    await appendEvent(dir, ev as any);
    await appendEvent(dir, { ...ev, node_id: "n_3b" } as any);
    const all = await readEvents(dir);
    expect(all.length).toBe(2);
    expect(all[1].node_id).toBe("n_3b");
    await fs.rm(dir, { recursive: true });
  });

  it("rejects invalid event on append", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "vh-ev-"));
    await expect(appendEvent(dir, { foo: "bar" } as any)).rejects.toThrow(/invalid event/);
    await fs.rm(dir, { recursive: true });
  });
});

describe("newNodeId", () => {
  it("root", () => expect(newNodeId(null, 0)).toBe("n_root"));
  it("first child of root", () => expect(newNodeId("n_root", 0)).toBe("n_1a"));
  it("third child of root", () => expect(newNodeId("n_root", 2)).toBe("n_3c"));
  it("first grandchild (depth 2)", () => expect(newNodeId("n_1a", 0)).toBe("n_1a_1a"));
  it("second grandchild (depth 2)", () => expect(newNodeId("n_1a", 1)).toBe("n_1a_2b"));
  it("throws on siblingCount >= 26 to prevent non-letter ASCII suffix", () => {
    expect(() => newNodeId("n_root", 26)).toThrow(/breadth limit 26/);
  });
  it("throws on negative siblingCount", () => {
    expect(() => newNodeId("n_root", -1)).toThrow(/non-negative integer/);
  });
});

describe("readEvents resilience", () => {
  it("returns [] on missing events.jsonl (ENOENT)", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "vh-empty-"));
    expect(await readEvents(dir)).toEqual([]);
    await fs.rm(dir, { recursive: true });
  });

  it("skips malformed lines with a warn (resilient default)", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "vh-bad-"));
    const goodLine = JSON.stringify({ ...baseEvent, ts: nowIso() });
    await fs.writeFile(join(dir, "events.jsonl"), goodLine + "\n{this is broken json\n" + goodLine + "\n", "utf8");
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
      const events = await readEvents(dir);
      expect(events.length).toBe(2);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toMatch(/skipping malformed/);
    } finally { console.warn = orig; }
    await fs.rm(dir, { recursive: true });
  });

  it("strict mode throws on malformed line", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "vh-strict-"));
    await fs.writeFile(join(dir, "events.jsonl"), "{not json\n", "utf8");
    await expect(readEvents(dir, { strict: true })).rejects.toThrow(/parse failed/);
    await fs.rm(dir, { recursive: true });
  });

  it("validate option schema-checks each line", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "vh-valid-"));
    await fs.writeFile(join(dir, "events.jsonl"), JSON.stringify({ ts: "x", engagement_id: "e", event: "node_add", confidance: 1 }) + "\n", "utf8");
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
      const events = await readEvents(dir, { validate: true });
      expect(events.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toMatch(/schema mismatch/);
    } finally { console.warn = orig; }
    await fs.rm(dir, { recursive: true });
  });
});
