---
name: ingest-recipes
description: Tool-ingest discipline for /vibehack-ingest — four modes (CLI/repo/name+desc/inline), validation gate, recipe template.
---

# Ingest Recipes

## Modes

### Mode 1: CLI on PATH
1. `which <name>` → confirm
2. Capture `<name> --help` and `<name> --version`
3. Draft `skills/recipes/<name>/SKILL.md` with: install hint, usage, common flags, output format, recipe examples for vibehack contexts.

### Mode 2: Public git repo
1. Clone to `~/.pi/agent/vibehack/tools/<slug>/`
2. Read README, identify build command, run it
3. Capture `--help`; draft recipe + install/build steps

### Mode 3: Name + description (synthesis)
1. Plan the tool: language (Python preferred for OSINT/parsing; Go for network), entrypoint, deps
2. Write to `~/.pi/agent/vibehack/tools/<slug>/{bin/<name>, README.md, requirements.txt or go.mod}`
3. **Validate**: run with `--help` (exit 0) or against `--validate-against <target>` if provided
4. On failure: rollback the directory and exit non-zero

### Mode 4: Inline spec
Same as Mode 3, but operator-authored spec is the brief.

## Recipe template

```markdown
---
name: <tool>
description: One-line purpose.
---

# <tool>

## Install
`<install-cmd>`

## Common patterns
- `<tool> <usage>` — for X
- `<tool> <usage>` — for Y

## Output format
`<format>`

## vibehack contexts
- Use during phase=recon when surface is X
- Use during phase=exploit when target is Y
```
