# ADR 0003 — `before_provider_request` wire-layer recall injection

## Status
Accepted.

## Context
Most public harnesses make the agent *call* a recall tool to remember things. That's prompt-fragile and consumes turn budget.

## Decision
Hook `before_provider_request`. Read current open hypothesis from events.jsonl tail; query graphify for top-3 relevant subgraphs; inject as `<recall>` system block. Agent gets grounded context every turn for free.

## Consequences
- No public harness does this.
- DCP rule `prune-stale-recall` keeps only the current turn's injection.
- Recall budget capped at 3 subgraphs / 2k tokens to bound cost.
