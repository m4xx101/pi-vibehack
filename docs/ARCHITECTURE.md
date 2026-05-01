# pi-vibehack architecture

See [`docs/superpowers/specs/2026-04-29-pi-vibehack-design.md`](../docs/superpowers/specs/2026-04-29-pi-vibehack-design.md) for the canonical design spec.

This file is a high-level orientation for contributors. Read the spec for details.

## Layers

```
┌────────────────────────────────────────────────┐
│ Operator's pi window (Planner role)            │
│  - read, grep, vibehack_*                      │
│  - hooks: session_start, before_agent_start,   │
│    tool_call, tool_result, before_provider_*,  │
│    session_before_compact                      │
│  - DCP rules trim working context              │
├────────────────────────────────────────────────┤
│ Subprocess pool (Operator + Reporter)          │
│  - pi --mode json -p --no-session              │
│  - structured JSON return contract             │
│  - context-isolated per spawn                  │
├────────────────────────────────────────────────┤
│ Filesystem (event log + folded views)          │
│  - events.jsonl (truth)                        │
│  - tree.md, findings.md (rendered)             │
│  - poc/<node_id>/ (per-leaf artifacts)         │
│  - audit.log (tool-call mirror)                │
│  - graphify graph (engagement + global)        │
│  - lessons.jsonl (cross-session)               │
└────────────────────────────────────────────────┘
```

## Memory layers (six)

| Layer | Mechanism | Lifetime |
|---|---|---|
| Working context | `pi-dcp` rules | Per turn |
| Auto-injected grounding | `before_provider_request` + graphify | Per turn |
| Hand-curated facts | `/vibehack-pin` → AGENTS.md | Per engagement / global |
| Subprocess transition | auto-handoff prompt | Per subprocess hop |
| Replayable truth | events.jsonl | Forever |
| Cross-engagement | global graphify graph + lessons.jsonl | Forever |

## File map

See spec §4.1.
