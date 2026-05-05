import { Type, type Static } from "@sinclair/typebox";

// Strict ISO 8601 date-time pattern with timezone designator.
// Accepts: 2026-04-29T10:23:45Z, 2026-04-29T10:23:45.123Z, 2026-04-29T10:23:45+02:00.
// Rejects: bare dates, locale strings, missing timezone.
//
// Applied via Type.String({ pattern: ... }) instead of FormatRegistry.Set to stay
// portable across @sinclair/typebox 0.32 AND pi-mono's bundled `typebox` 1.x
// (which aliases @sinclair/typebox imports to a different library lacking
// FormatRegistry). Pattern-based validation is universally supported by both.
const ISO_8601_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?(Z|[+-]\\d{2}:?\\d{2})$";

const TS_FIELD = () => Type.String({ pattern: ISO_8601_PATTERN });

export const EvidenceSchema = Type.Object({
  ts: TS_FIELD(),
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
export const LegacyEventSchema = Type.Object({
  ts: TS_FIELD(),
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

// v1.1 event types (§3.6, §4.3) — share legacy envelope convention: discriminated by
// `event` field, carry `engagement_id`. These are strict per-type schemas; cross-field
// invariants belong in validateEvent(), not here.
export const VerificationPassSchema = Type.Object({
  event: Type.Literal("verification_pass"),
  engagement_id: Type.String(),
  node_id: Type.String(),
  kind: Type.String(),
  verifier: Type.String(),
  evidence_ref: Type.String(),
  ts: TS_FIELD(),
}, { additionalProperties: false });

export const VerificationFailSchema = Type.Object({
  event: Type.Literal("verification_fail"),
  engagement_id: Type.String(),
  node_id: Type.String(),
  kind: Type.String(),
  verifier: Type.String(),
  reason: Type.String(),
  ts: TS_FIELD(),
}, { additionalProperties: false });

export const VerificationAdvisorySchema = Type.Object({
  event: Type.Literal("verification_advisory"),
  engagement_id: Type.String(),
  node_id: Type.String(),
  kind: Type.String(),
  message: Type.String(),
  ts: TS_FIELD(),
}, { additionalProperties: false });

export const CanaryPlantedSchema = Type.Object({
  event: Type.Literal("canary_planted"),
  engagement_id: Type.String(),
  node_id: Type.String(),
  canary_kind: Type.Union([
    Type.Literal("filesystem"),
    Type.Literal("http-callback"),
    Type.Literal("dns"),
    Type.Literal("blind-oob"),
  ]),
  uuid: Type.String(),
  ref: Type.String(),
  callback_url: Type.Optional(Type.String()),
  ts: TS_FIELD(),
}, { additionalProperties: false });

// v1.3: persona-switch event for the specialist registry.
export const PersonaSwitchSchema = Type.Object({
  event: Type.Literal("persona_switch"),
  engagement_id: Type.String(),
  ts: TS_FIELD(),
  metadata: Type.Object({
    name: Type.String(),
    rationale: Type.Optional(Type.String()),
  }, { additionalProperties: false }),
}, { additionalProperties: false });

// v1.3: structured vulnerability report.
export const VulnReportedSchema = Type.Object({
  event: Type.Literal("vuln_reported"),
  engagement_id: Type.String(),
  node_id: Type.String(),
  ts: TS_FIELD(),
  vuln: Type.Object({
    title: Type.String(),
    severity: Type.Union([
      Type.Literal("info"),
      Type.Literal("low"),
      Type.Literal("medium"),
      Type.Literal("high"),
      Type.Literal("critical"),
    ]),
    cvss: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
    affected_url: Type.String(),
    impact: Type.String(),
    reproduction_steps: Type.Array(Type.String()),
    evidence_paths: Type.Array(Type.String()),
    owasp: Type.Optional(Type.String()),
    cwe: Type.Optional(Type.String()),
    report_path: Type.Optional(Type.String()),
  }, { additionalProperties: false }),
}, { additionalProperties: false });

export const EventSchema = Type.Union([
  LegacyEventSchema,
  VerificationPassSchema,
  VerificationFailSchema,
  VerificationAdvisorySchema,
  CanaryPlantedSchema,
  PersonaSwitchSchema,
  VulnReportedSchema,
]);

export type VibehackEvent = Static<typeof EventSchema>;
