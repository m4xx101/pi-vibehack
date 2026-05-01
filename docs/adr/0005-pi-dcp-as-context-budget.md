# ADR 0005 — `pi-dcp` as Planner context budget

## Status
Accepted.

## Context
Long engagements drift past 50k tokens. Pi's compaction runs only at threshold; we want continuous trim.

## Decision
Use `pi-dcp` (hard dep). Register four vibehack-specific rules: `prune-stale-tool-results`, `prune-folded-evidence`, `prune-stale-recall`, `prune-dead-branches`. Working set stays under 20k tokens regardless of engagement length.

## Consequences
- Planner stays sharp.
- Each rule has unit tests + a `keep-last-N-turns` floor.
- Dead-node tracking lives in module-globals — works because pi runs each session as one process.
