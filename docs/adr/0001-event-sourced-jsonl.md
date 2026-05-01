# ADR 0001 — Event-sourced JSONL as source of truth

## Status
Accepted (locked at design).

## Context
Fenrir uses a SQLite + flat-text wiki. The SOTA harness research found JSONL beats DB until > 10k findings, and pi's `appendEntry` + session JSONL gives event sourcing for free.

## Decision
Store every tree mutation, evidence add, tool call, and tool result as one JSON line in `events.jsonl`. Tree, findings, lessons, and graphify-fed graph are all *folded* views. No DB, no SQLite.

## Consequences
- Replay is free.
- Git-diffable per engagement.
- Slow at >10k events; mitigated with in-memory fold cache and append-invalidation.
- Schema drift forbidden — typebox validates every append.
