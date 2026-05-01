# ADR 0006 — Subprocess isolation for untrusted output

## Status
Accepted.

## Context
HTTP responses, file contents, and shell output are untrusted text. Prompt-injection from a malicious target page is a real attack surface (Simon Willison's "lethal trifecta").

## Decision
Operator and Reporter run as `pi --mode json -p --no-session` subprocesses. They never see the Planner's transcript. The structured-JSON return contract is the only channel; we schema-validate before any field reaches the Planner.

## Consequences
- One target-side prompt injection cannot poison the persistent Planner reasoning chain.
- Slight per-spawn cost (~few hundred ms).
- Subprocess respawn on `blocked-on-auth` is cheap because there's no state to lose.
