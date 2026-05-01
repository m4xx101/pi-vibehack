# ADR 0004 — `pi-prompt-template-model` as dispatch layer

## Status
Accepted.

## Context
Fenrir-style profile config files (`hybrid` / `local` / `frontier`) require runtime profile state and a custom router provider.

## Decision
Use `nicobailon/pi-prompt-template-model` (hard dep). Every slash command ships as a frontmatter template pinning `model` / `thinking` / `skill` with `restore: true`. Profile = a one-time install-time `sed` over the prompt frontmatter; per-role override flags persist to `.profile`.

## Consequences
- No custom router provider.
- Reinstalling with a different profile is the only way to switch — keeps it mechanical and replay-deterministic.
