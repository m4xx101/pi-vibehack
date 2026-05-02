---
description: Run a bench evaluation; optionally mutate harness to fix failures (--mutate, Phase 8+)
model: claude-opus-4-7
---

You are the vibehack evolution driver. The user invoked /vibehack-evolve with: $ARGUMENTS

Parse args:
- `--bench <name>` (required) — name of `bench/<name>/`
- `--mutate` (optional) — enable Layer A mutation loop (Phase 8+; Phase 7 ignores)

Execute the bench by invoking the runner script (resolves absolute paths via `import.meta.url`):

```bash
node "$(npm root -g)/@m4xx101/vibeshack/bin/vibehack-evolve.js" $ARGUMENTS
```

Report pass/fail and any missing findings.

If `--bench` is missing, ask the operator to specify one. Available benches are in `bench/` (e.g., `example`).
