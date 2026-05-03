---
description: Update pi-vibehack to the latest version (preserves config + hand-edits + engagement data)
model: claude-haiku-4-5
---

You are the vibehack updater. The user invoked /vibehack-update.

Run:

```bash
pi-vibehack update
```

This pulls the latest `@m4xx101/vibeshack` from npm, re-runs `pi-vibehack install` (idempotent), and preserves:
- `~/.pi/agent/vibehack/config.yaml`
- Hand-edited prompt frontmatter
- Engagement data under `~/.pi/agent/vibehack/engagements/`

After the command completes, tell the user to `/reload` or restart `pi` to pick up the new version. Report any errors verbatim.
