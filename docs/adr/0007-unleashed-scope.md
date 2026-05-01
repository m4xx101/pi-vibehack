# ADR 0007 — Unleashed scope (audit-log only)

## Status
Accepted.

## Context
Authorization is the operator's responsibility. Built-in scope gates produce false positives, slow operators down, and provide false comfort.

## Decision
The `tool_call` hook never returns `{block: true}` for scope/cost reasons. Every tool call is mirrored into `audit.log` and `events.jsonl`. No `--gov`, no `rm -rf` carve-outs, no cost-cap hard blocks. Cost is tallied; banner shows it; nothing blocks.

## Consequences
- Operator must self-police.
- README and first-run banner carry the "authorized testing only" disclaimer.
- audit.log is the forensic record.
