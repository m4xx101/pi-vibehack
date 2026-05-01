---
description: Distill (situation, action, outcome) lessons from recent engagements
model: claude-sonnet-4-6
thinking: medium
skill: distill-recipes
restore: true
---

Read the last 3 engagements' events.jsonl files. Extract recurring (situation → action → outcome) patterns. Write refined recipe SKILL.md files into `skills/learned/`.

If `--specialists` flag present, refine `skills/specialists/<kind>/SKILL.md` files instead of recipe skills, based on which specialist kinds were used in successful confirmations.

Hot-reload requires `/reload` after this command.
