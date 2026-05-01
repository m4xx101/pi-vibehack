---
description: Ingest a tool (CLI, repo, name+description, or inline spec); optionally a specialist skill
model: claude-opus-4-7
thinking: xhigh
skill: ingest-recipes
restore: true
---

Ingest target: $@

Modes (auto-detected):
- If `$1` exists on PATH (`which $1`): mode=CLI — run `--help`, draft a recipe SKILL.md.
- If `$1` looks like a git URL: mode=repo — clone to `~/.pi/agent/vibehack/tools/<slug>/`, read README + `--help`.
- If `--specialist <kind>` flag is present: draft `~/.pi/agent/vibehack/specialists/learned/<kind>/SKILL.md`.
- If `--inline` flag is present: treat the rest as an inline spec; write a Python or Go tool from scratch.
- Otherwise: treat `$@` as a name+description; search, propose, write, validate, ship a tool.

Validation: run with `--help` (exit code 0) by default; if `--validate-against <target>` provided, sanity-check output against it.

Failed validation rolls back the directory. On success, append a `vibehack_tool` event.
