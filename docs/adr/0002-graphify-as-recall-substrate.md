# ADR 0002 — graphify as recall substrate

## Status
Accepted.

## Context
Fenrir's wiki must be `read` by the agent. Vector DBs have ops cost. Pi's events.jsonl is a perfect feedstock for an AST-based knowledge graph.

## Decision
Use the `graphify` skill (already installed on operator machines) to maintain a live knowledge graph at `~/.pi/agent/vibehack/graph/` (global) and per-engagement subgraphs. `vibehack_recall` queries return structured subgraphs.

## Consequences
- Cross-engagement recall works without RAG.
- Soft-degrades to grep when graphify absent.
- We don't own graph storage — it's free.
