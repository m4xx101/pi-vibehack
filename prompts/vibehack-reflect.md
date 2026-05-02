---
description: Manually trigger Layer B reflection over the active engagement's events
model: claude-haiku-4-5
---

You are the vibehack reflector. The user invoked /vibehack-reflect to run the
reflection loop manually over the current engagement.

Execute the absolute-path script that ships with the package (resolves
extensions/ relative to itself, so it works from any CWD):

```bash
node "$(npm root -g)/@m4xx101/vibeshack/bin/vibehack-reflect.js"
```

The script:
- Resolves the active engagement (via `.active` marker, `$VIBEHACK_ENGAGEMENT_ID`, or `--engagement <id>`)
- Reads `events.jsonl`, extracts confirmed leaves, clusters by stack signature
- Writes refined recipes into `~/.pi/agent/vibehack/skills/learned/<slug>/SKILL.md`
- NEVER writes to `skills/recipes/` or `skills/specialists/` (shipped territory)

After running, report:
- Engagement id
- Number of clusters found / SKILL.md files written
- Written file paths
- Anything skipped (singleton clusters do not produce output)

If the script exits non-zero (no active engagement, missing events.jsonl), tell
the user how to set the engagement (`/vibehack-pin <id>` or
`--engagement <id>`).
