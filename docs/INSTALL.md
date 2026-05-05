# Install

Comprehensive install reference for pi-vibehack **v1.4**.

> **Authorized testing only.** The installer prints this disclaimer on first run. Acknowledge it and proceed with scope you actually have permission to test. See [SECURITY.md](SECURITY.md).

---

## Prerequisites

- **Node.js ≥ 18** (`node --version`).
- **pi-mono** (`@mariozechner/pi-coding-agent`). The installer aborts with a hint if `pi` is not on PATH:

  ```bash
  npm i -g @mariozechner/pi-coding-agent
  pi --version
  ```

- A configured LLM provider (Anthropic API key for default `hybrid`/`frontier`; or a local server for `local`). See [pi-mono README](https://github.com/badlogic/pi-mono#configuration).

---

## Installing pi-vibehack

```bash
npx -y @m4xx101/vibeshack install
```

What this does, step by step (matches `bin/install.js`):

1. Verifies `pi` is on PATH (exits with code 2 if not).
2. Resolves the settings path: `~/.pi/agent/settings.json` (global, default) or `.pi/settings.json` (project-scoped, with `--local`).
3. Adds `npm:@m4xx101/vibeshack@<pinned-version>` to the `packages` array. Idempotent: re-running with a different version replaces the existing entry. The patcher has a scoped-name foot-gun guard so it won't accidentally pick up a similarly-named package.
4. Adds `npm:pi-prompt-template-model@^0.9.0` and `npm:@zenobius/pi-dcp@^0.1.0` (the two hard deps with verified registry names — these names differ from the original spec, see [RESUME.md deviation #1](../RESUME.md)).
5. Creates the runtime data dir at `~/.pi/agent/vibehack/`:
   ```
   ~/.pi/agent/vibehack/
   ├── AGENTS.md           ← global pinned facts (preserved across reinstalls)
   ├── lessons.jsonl       ← cross-session distilled lessons
   ├── graph/              ← global graphify graph (if graphify installed)
   ├── tools/              ← ingested + synthesized tools
   │   └── PATH-shim.sh    ← prepended for spawned subprocesses
   ├── specialists/learned/ ← operator-grown specialists
   ├── engagements/        ← one subdir per engagement
   └── .profile            ← model triplet for resolved profile
   ```
6. Writes `.profile` with the resolved planner/operator/reporter triplet.
7. Rewrites prompt frontmatter (`prompts/*.md`) at install-time to pin the resolved models (this is what makes per-role overrides actually work — see [§Per-role overrides](#per-role-overrides) below).
8. Detects optional deps; prints one-line `💡 install X for Y` advisory hints (no auto-install). The hints are unconditional in `bin/install.js`; runtime detection lives in the `session_start` hook ([RESUME.md deviation #14](../RESUME.md)).
9. Prints the authorized-testing-only disclaimer.
10. Prints: `✓ pi-vibehack installed. Restart pi or /reload. Run /vibehack <target> to start.`

If `npm install` warns about peer deps, re-run with `--legacy-peer-deps` (the transitive postinstall fails without it on some Node versions; the warning is advisory).

---

## Soft companions

These are optional. Each one unlocks more of the harness.

### graphify — the recall substrate

```bash
npm i -g graphify
```

**Unlocks:** the wire-layer `<recall>` auto-injection (the [10× move](ARCHITECTURE.md#the-10x-move)). Every `confirm` and `evidence_add` triggers a `graphify update`; `before_provider_request` queries the global graph and silently injects top-3 subgraphs into the Planner system prompt every turn.

**Auto-detection:** `session_start` checks `which graphify`. If absent, the banner reads `💡 install graphify for cross-engagement <recall>`.

**Absent behavior:** `before_provider_request` falls back to grep-over-events.jsonl using simple keyword matching. The `<recall>` block still appears, just smaller and engagement-local.

### pi-super-curl — HTTP/auth surface

```bash
npm i -g pi-super-curl
```

**Unlocks:** the canonical HTTP execution surface. `super-curl.md` recipe loads instead of `curl.md` (the swap is automatic). Three ship templates (`auth-bearer-probe`, `jwt-tamper`, `csrf-replay`) become available. The `blocked-on-auth` round-trip uses `sendToAgent` to flow operator-pasted values back into the Operator subprocess without breaking flow.

**Auto-detection:** `session_start` checks `which scurl`. Banner: `💡 install pi-super-curl for /scurl auth round-trip`.

**Absent behavior:** `curl.md` recipe loads. The Operator can still report `outcome: "blocked-on-auth"`; the Planner just can't auto-fire `/scurl <template>`.

### surf-cli — browser automation

```bash
npm i -g surf-cli
```

**Unlocks:** the browser-required-leaf path. When a hypothesis is marked `requires_browser: true`, the Operator subprocess auto-loads the `surf-cli` recipe (Chrome control via DevTools Protocol). Action sequences land in `poc/<node_id>/browser.jsonl`.

**Auto-detection:** `session_start` checks `which surf` and `which playwright`. Banner: `💡 install surf-cli for browser-required leaves`.

**Absent behavior:** `playwright-cli.md` recipe loads as fallback (uses `npx playwright`). If neither is present, the leaf is recorded but execution best-effort.

### pi-prompt-template-model (hard dep)

```bash
npm i -g pi-prompt-template-model
```

Already added to `settings.json` by the installer. This is the frontmatter dispatch layer — every slash command's `model:` / `thinking:` / `skill:` directives are honored by this extension. Without it, `/confirm`, `/expand`, etc. fall back to pi defaults. ([ADR-0004](adr/0004-prompt-template-model-as-dispatch.md))

### pi-dcp (hard dep)

```bash
npm i -g @zenobius/pi-dcp
```

Already added by the installer. Picks up vibehack's four DCP rules via the global `__vibehack_dcp_rules` export (see `extensions/pi-vibehack/index.ts:40`). Without it, working context grows unbounded; engagements over ~30 turns slow down. ([ADR-0005](adr/0005-pi-dcp-as-context-budget.md))

---

## Profiles

```bash
npx -y @m4xx101/vibeshack install --profile hybrid     # default
npx -y @m4xx101/vibeshack install --profile frontier
npx -y @m4xx101/vibeshack install --profile local
```

| Profile | Planner | Operator | Reporter | Notes |
|---|---|---|---|---|
| `hybrid` | `claude-haiku-4-5` | `claude-opus-4-7` | `claude-opus-4-7` | Daily driver. Steering on Haiku is fast and cheap; execution on Opus is precise. |
| `frontier` | `claude-sonnet-4-6` | `claude-opus-4-7` | `claude-opus-4-7` (xhigh) | Sonnet 4.6 reasoning for hard targets. Reporter goes xhigh thinking. |
| `local` | `qwen-72b-instruct` | `qwen-72b-instruct` | `qwen-72b-instruct` | Air-gapped / sensitive engagements. Requires LM Studio / vLLM / Ollama. See [§Local-model setup](#local-model-setup). |

The profile triplet is persisted to `~/.pi/agent/vibehack/.profile`. Reinstalling with a different `--profile` rewrites the file and the prompt frontmatter.

---

## Per-role overrides

```bash
npx -y @m4xx101/vibeshack install --profile hybrid \
  --planner claude-haiku-4-5 \
  --operator claude-opus-4-7 \
  --reporter claude-sonnet-4-6
```

Use cases:

- Run Reporter on a cheaper model than Operator if your engagements are eval-heavy but report-light.
- Pin Planner to a specific model in CI to make replays deterministic.
- Mix providers — Operator on Anthropic, Planner on a local Qwen — by combining `--profile local --operator claude-opus-4-7`.

The override values must resolve through pi's MODELS registry or via a `pi-prompt-template-model` custom provider entry (see [§Local-model setup](#local-model-setup)).

---

## Data-dir override

```bash
VIBEHACK_DATA_DIR=/srv/vibehack-test npx -y @m4xx101/vibeshack install
```

Or as an env var at runtime:

```bash
VIBEHACK_DATA_DIR=/srv/eng-2026-05/ pi
```

Used by `extensions/pi-vibehack/lib/engagement.ts:vibehackRoot()`. Useful for:

- Container deploys (mount a volume, point this at it).
- Per-environment dev (separate test data from real engagements).
- Multi-operator hand-off via shared filesystem.

If unset, defaults to `~/.pi/agent/vibehack/`.

---

## `--local` (project-scoped install)

```bash
npx -y @m4xx101/vibeshack install --local
```

Patches `<cwd>/.pi/settings.json` instead of `~/.pi/agent/settings.json`. Engagement data still goes to `~/.pi/agent/vibehack/` (or wherever `VIBEHACK_DATA_DIR` points). Useful for repos where you want vibehack scoped to a single project.

---

## Local-model setup

The `local` profile expects a `qwen-72b-instruct` (or equivalent) reachable via an OpenAI-compatible endpoint. pi-mono's MODELS registry doesn't ship local models by default; you register them via `pi-prompt-template-model` custom-provider frontmatter.

### LM Studio

```bash
# 1. Install LM Studio, download Qwen 2.5 72B Instruct, start the server (default :1234).
# 2. Register the provider in your pi config; see pi-prompt-template-model README.
# 3. Install vibehack with --profile local.
npx -y @m4xx101/vibeshack install --profile local
```

### vLLM

```bash
vllm serve Qwen/Qwen2.5-72B-Instruct --port 8000
```

Then point pi-prompt-template-model at `http://localhost:8000/v1` (OpenAI-compatible).

### Ollama

```bash
ollama pull qwen2.5:72b
ollama serve
```

Sample frontmatter for a custom provider entry (refer to [pi-prompt-template-model docs](https://github.com/nicobailon/pi-prompt-template-model) for the exact shape).

For sensitive engagements where data must not egress, **`--profile local` is the recommendation**. See [SECURITY.md §Data exfiltration risk](SECURITY.md#data-exfiltration-risk).

---

## Updating

### From shell

```bash
pi-vibehack update
```

One command. Pulls the latest `@m4xx101/vibeshack` from the `latest` dist-tag and re-runs `pi-vibehack install` (idempotent). Re-execs the freshly-installed binary so the new version's install logic runs.

### From inside pi

```
/vibehack-update
```

Same operation. After completion, restart pi or `/reload` to load the new version.

### What gets preserved

- `~/.pi/agent/vibehack/config.yaml` (model assignments + thresholds + provider config)
- Hand-edited prompt frontmatter (only the `model:` line per role group gets rewritten)
- `~/.pi/agent/vibehack/engagements/` — all engagement state, events.jsonl, evidence, pinned facts
- `~/.pi/agent/vibehack/skills/learned/` — Layer B reflection output (operator-edited recipes are auto-detected and never clobbered)
- `~/.pi/agent/vibehack/.capabilities.json` — Kali tool cache (refresh with `/vibehack-rescan-kali`)

### What gets refreshed

- `@m4xx101/vibeshack` package itself
- `~/.pi/agent/settings.json` package list (exact pi-dcp version re-pinned via preflight)
- Prompt frontmatter `model:` lines (regenerated from current `config.yaml`)

### Sanity check

```bash
pi-vibehack --version
```

The installer is **idempotent**: rerunning is safe at any time. It compares state and only writes what changed.

---

## Uninstalling

```bash
pi-vibehack uninstall
```

What's removed:

- The `npm:@m4xx101/vibeshack@<version>` line from `settings.json`.

What's preserved:

- Engagement data at `~/.pi/agent/vibehack/engagements/`.
- The global graphify graph at `~/.pi/agent/vibehack/graph/`.
- `lessons.jsonl`, `AGENTS.md`, `tools/`, `specialists/learned/`.

If you want a full wipe, remove `~/.pi/agent/vibehack/` manually after uninstall.

The uninstall message reports the actual `--data-dir` if you used one (not a hardcoded path — see [RESUME.md deviation #13](../RESUME.md)).

---

## Verifying installation

```bash
pi --version                       # confirms pi-mono present
```

In a pi session:

```
/reload                            # picks up the extension
/vibehack-cost                     # prints "no active engagement" — confirms extension loaded
```

If `/vibehack-cost` is unrecognized, the extension didn't load. Check:

- `~/.pi/agent/settings.json` contains the `npm:@m4xx101/vibeshack@…` line.
- The two hard deps are also there.
- Run `pi` with `DEBUG=pi:*` to see extension loading errors.

See [TROUBLESHOOTING.md §Install issues](TROUBLESHOOTING.md#install-issues) for common errors.

---

## Reinstall semantics

| Action | Effect |
|---|---|
| Re-run `install` with same flags | No-op (idempotent). |
| Re-run with new `--profile` | Rewrites `.profile` + prompt frontmatter. |
| Re-run with new `--planner`/`--operator`/`--reporter` | Rewrites only the changed role; others stay. |
| Re-run with new package version | Replaces the `npm:@m4xx101/vibeshack@…` line. |
| Manually edit `settings.json` | Honored. Re-running install will not duplicate the line. |

---

## Soft-dep install hints

The installer prints these unconditionally as advisory:

```
💡 install graphify for cross-engagement <recall>
💡 install pi-super-curl for /scurl auth round-trip
💡 install surf-cli for browser-required leaves
```

Runtime detection (which determines actual recipe loading) lives in the `session_start` hook, not in `install.js`. This separation means you can install soft deps after vibehack and they'll Just Work next pi boot. ([RESUME.md deviation #14](../RESUME.md))

---

## Troubleshooting common install errors

- **`pi: command not found`** → install pi-mono first.
- **`npm ERR! peer dep missing`** → re-run with `npm install --legacy-peer-deps` or trust the warning (advisory).
- **`EACCES: permission denied`** → `npm config set prefix ~/.npm-global` then add to PATH.
- **Settings already contains line, install skips** → `npx -y @m4xx101/vibeshack uninstall` then reinstall.
- **`/vibehack` unrecognized after install** → run `/reload` or restart pi.
- **`<recall>` blocks empty after engagement runs** → install graphify (`npm i -g graphify`).

Full troubleshooting matrix: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## Authorized-testing-only disclaimer

The installer prints this on first run:

> pi-vibehack runs with unleashed scope by design. The operator is responsible for authorization. Do not point this at any system you do not own or have explicit, written permission to test. The audit.log at `~/.pi/agent/vibehack/engagements/<id>/audit.log` is your forensic record.

Read [SECURITY.md](SECURITY.md) before your first engagement.
