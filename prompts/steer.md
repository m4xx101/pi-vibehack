---
description: Inject a free-text steering note into the next Planner turn
model: claude-haiku-4-5
thinking: minimal
skill: planner-recipes
restore: true
---

Operator steer: $@

Append a `<steer>` block in your next `before_agent_start` for the Planner. Do not act now — let the Planner re-prioritize on its next turn.
