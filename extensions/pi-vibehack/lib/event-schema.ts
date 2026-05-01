import { FormatRegistry, Type, type Static } from "@sinclair/typebox";

// Strict ISO 8601 date-time validator with timezone designator.
// Accepts: 2026-04-29T10:23:45Z, 2026-04-29T10:23:45.123Z, 2026-04-29T10:23:45+02:00.
// Rejects: bare dates, locale strings, missing timezone.
// Registered once at module load so Type.String({ format: "date-time" }) checks succeed.
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;
if (!FormatRegistry.Has("date-time")) {
  FormatRegistry.Set("date-time", (value) => {
    if (typeof value !== "string" || !ISO_8601.test(value)) return false;
    const d = new Date(value);
    return !Number.isNaN(d.getTime());
  });
}

export const EvidenceSchema = Type.Object({
  ts: Type.String({ format: "date-time" }),
  kind: Type.String(),
  ref: Type.String(),
  summary: Type.String(),
  synthetic: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

export const EventTypes = [
  "engagement_start", "engagement_end",
  "node_add", "node_update", "node_prune",
  "evidence_add", "confirm", "steer",
  "tool_call", "tool_result",
  "lesson", "vibehack_tool",
  "chain_propose", "chain_confirm", "chain_reject",
  "specialist_propose",
] as const;

// node_id / parent_id formats are intentionally unconstrained at the schema layer —
// the convention (e.g. "n_3a") is enforced by lib/events.ts:newNodeId in Task 3.2.
// Cross-field invariants (e.g. confirm requires non-empty evidence) belong in
// validateEvent() (Task 3.2), not here — typebox can't express them statically.
export const EventSchema = Type.Object({
  ts: Type.String({ format: "date-time" }),
  engagement_id: Type.String(),
  event: Type.Union(EventTypes.map((t) => Type.Literal(t))),
  node_id: Type.Optional(Type.String()),
  parent_id: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  kind: Type.Optional(Type.Union([
    Type.Literal("root"), Type.Literal("surface"),
    Type.Literal("hypothesis"), Type.Literal("leaf"),
  ])),
  phase: Type.Optional(Type.Union([
    Type.Literal("recon"), Type.Literal("enum"), Type.Literal("exploit"),
    Type.Literal("post-ex"), Type.Literal("lateral"), Type.Literal("report"),
  ])),
  claim: Type.Optional(Type.String()),
  next_test: Type.Optional(Type.String()),
  falsifier: Type.Optional(Type.String()),
  confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  status: Type.Optional(Type.Union([
    Type.Literal("open"), Type.Literal("in-flight"),
    Type.Literal("confirmed"), Type.Literal("pruned"), Type.Literal("dead"),
  ])),
  requires_browser: Type.Optional(Type.Boolean()),
  evidence: Type.Optional(Type.Array(EvidenceSchema)),
  cost_tokens: Type.Optional(Type.Number({ minimum: 0 })),
  cost_usd: Type.Optional(Type.Number({ minimum: 0 })),
  rationale: Type.Optional(Type.String()),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
}, { additionalProperties: false });

export type VibehackEvent = Static<typeof EventSchema>;
