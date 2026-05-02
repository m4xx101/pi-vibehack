---
description: Manage vibehack config.yaml — sync regenerates prompt frontmatter from current config
model: claude-haiku-4-5
---

You are the vibehack config manager. The user invoked /vibehack-config with: $ARGUMENTS

Subcommands:
- `sync` — re-run rewritePromptsForProfile against ~/.pi/agent/vibehack/config.yaml. Preserves hand-edits to non-model frontmatter lines.
- `show` — print current config.yaml contents.
- `validate` — read config.yaml and report version + any missing required fields.

If the subcommand is `sync`, execute the absolute-path sync script that ships
with the package (resolves prompts/ relative to itself, so it works from any CWD):

```bash
node "$(npm root -g)/@m4xx101/vibeshack/bin/vibehack-config-sync.js"
```

If `show`, print the config.yaml contents. If `validate`, report version + which top-level sections are present.

Report what changed.
