# ADR 0009 — Specialists as skills, not subagents

## Status
Accepted.

## Context
Fenrir ships 16 specialist subagents. Cybench data shows specialization gains plateau at ~3 roles. CAI shipped 16 and the orchestration cost dwarfed reasoning cost on small targets.

## Decision
Three roles total (Planner / Operator / Reporter). Specialization happens via skill injection at Operator spawn time. Each specialist is a single `SKILL.md` file, prepended to the Operator's system prompt. Five shipped (`web-recon`, `web-exploit`, `binary-recon`, `auth-bypass`, `osint`); operator can ingest more via `/vibehack-ingest --specialist <kind>`.

## Consequences
- Same flexibility as 16-subagent design with ~zero structural complexity.
- New specialists land as markdown files; no new role plumbing.
- A specialist that genuinely needs different tools will stretch this — escape hatch is to ship a second Operator role file in v1.1.
