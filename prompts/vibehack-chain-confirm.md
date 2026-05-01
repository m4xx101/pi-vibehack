---
description: Confirm a proposed exploit chain; run sequentially (or step-by-step with --interactive)
model: claude-opus-4-7
thinking: high
skill: operator-recipes
subagent: vibehack-operator
inheritContext: false
restore: true
---

Confirm the most recent proposed chain. Run steps sequentially. If `--interactive` flag present, halt between steps for operator confirmation.

Each step writes to `poc/<node_id>/`. Halt on the first falsified step. Return per-step structured output.
