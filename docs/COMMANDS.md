# Commands Reference

Every slash command in pi-vibehack v1.0. 17 prompt files in [`prompts/`](../prompts/) plus 4 provider personas in [`prompts/personas/`](../prompts/personas/). Frontmatter values below are verified against the actual files at HEAD `ae3fb1e`.

Command groups:

- [Engagement lifecycle](#engagement-lifecycle) — `/vibehack`, `/vibehack-pause`, `/vibehack-resume`, `/vibehack-complete`
- [Tree verbs](#tree-verbs) — `/expand`, `/prune`, `/confirm`, `/steer`
- [Knowledge & tooling](#knowledge--tooling) — `/vibehack-ingest`, `/vibehack-distill`, `/vibehack-tree`
- [Chain control](#chain-control) — `/vibehack-chain-confirm`, `/vibehack-chain-reject`
- [Meta](#meta) — `/vibehack-cost`, `/vibehack-update`
- [Soft-companion](#soft-companion) — `/vibehack-pin`, `/vibehack-handoff`
- [Personas](#provider-personas) — CLAUDE / CODEX / GEMINI / LOCAL

Frontmatter fields:

- `description` — one-liner shown in pi's command palette.
- `model` — pinned at install-time via prompt-template-model dispatch. May be a chain (`a, b`) — first that resolves wins.
- `thinking` — `minimal | low | medium | high | xhigh`.
- `skill` — which recipe-skill to load.
- `subagent` — if present, dispatches to a subagent role file in `subagents/`.
- `inheritContext` — false → subprocess gets only the input contract, no Planner transcript.
- `restore` — true → after the command, model/thinking restore to defaults (avoids contaminating the Planner with a higher-thinking spillover).

---

## Engagement lifecycle

### `/vibehack <target>`

**Syntax:** `/vibehack <target>`
**Purpose:** Start a new engagement. Creates the engagement directory, root node, top-level surfaces, and one first hypothesis.

**Frontmatter:**
```yaml
description: Start a new vibehack engagement against the given target
model: claude-haiku-4-5, claude-sonnet-4-6
thinking: minimal
skill: planner-recipes
restore: true
```

**Side effects:**
- Creates `~/.pi/agent/vibehack/engagements/<YYYY-MM-DD-target-slug>/` (slug NFKD-folded, `untargeted` on bare-symbol input).
- Writes `.active` marker file pointing at the new engagement.
- Appends `engagement_start`, multiple `node_add` events to `events.jsonl`.
- Renders initial `tree.md` and `findings.md`.
- Status banner updates.

**Examples:**
```
/vibehack juice-shop.local
/vibehack acme.example
/vibehack 192.168.56.10                # CIDR / IP targets supported
```

**Common operator mistakes:**
- Running `/vibehack` while another engagement is active → the old one becomes inactive but data is preserved. Use `/vibehack-pause` first if you want a clean handoff.
- Forgetting that the slug is derived → `target.example` becomes `2026-05-02-target-example`.

**Related:** [`/vibehack-pause`](#vibehack-pause), [`/vibehack-resume`](#vibehack-resume), [`/vibehack-complete`](#vibehack-complete).

---

### `/vibehack-pause`

**Syntax:** `/vibehack-pause`
**Purpose:** Checkpoint the engagement. Emits a reflection summary on the root node, then stops.

**Frontmatter:**
```yaml
description: Pause the engagement; emit a reflection summary
model: test-planner
thinking: low
skill: planner-recipes
restore: true
```

**Side effects:**
- Appends a `vibehack_evidence` event on the root summarizing what's done, open, and the recommended next test.
- Does not flip engagement status (it remains active and resumable).

**Examples:**
```
/vibehack-pause
```

**Related:** [`/vibehack-resume`](#vibehack-resume), [`/vibehack-handoff`](#vibehack-handoff).

---

### `/vibehack-resume [id]`

**Syntax:** `/vibehack-resume` (latest) or `/vibehack-resume 2026-04-29-acme-example` (specific).
**Purpose:** Resume an engagement. Reads `tree.md`, picks the highest-confidence-gain open node, emits one mutation.

**Frontmatter:**
```yaml
description: Resume an engagement (latest by default, or by id)
model: test-planner
thinking: minimal
skill: planner-recipes
restore: true
```

**Side effects:**
- Sets `.active` marker to the resumed engagement.
- One `vibehack_expand` or `vibehack_evidence` event.

**Examples:**
```
/vibehack-resume
/vibehack-resume 2026-04-29-acme-example
```

**Related:** [`/vibehack-pause`](#vibehack-pause), [`/vibehack-tree`](#vibehack-tree).

---

### `/vibehack-complete`

**Syntax:** `/vibehack-complete`
**Purpose:** Spawn the final Reporter subprocess and write `report.md`.

**Frontmatter:**
```yaml
description: Close the engagement; spawn the final reporter
model: claude-opus-4-7
thinking: high
skill: reporter-recipes
subagent: vibehack-reporter
inheritContext: false
restore: true
```

**Side effects:**
- Spawns `pi --mode json -p --no-session` with the reporter system prompt and `inheritContext: false`.
- Writes `engagements/<id>/report.md`.
- Appends `engagement_end` event.
- Returns JSON to the Planner: `{"report_path": "report.md", "finding_count": N, "total_cost_usd": X}`.

**Examples:**
```
/vibehack-complete
```

**Common operator mistakes:**
- Running on an empty tree → the reporter writes an "engagement closed without findings" report. Confirm at least one leaf first if you want a substantive deliverable.
- Forgetting per-leaf reporters already ran on `/confirm` — the final reporter aggregates, doesn't re-author.

**Related:** [`/vibehack-distill`](#vibehack-distill).

---

## Tree verbs

### `/expand <node>`

**Syntax:** `/expand n_3a`
**Purpose:** Force-expand children under the named node.

**Frontmatter:**
```yaml
description: Expand a hypothesis-tree node
model: test-planner
thinking: minimal
skill: planner-recipes
restore: true
```

**Side effects:**
- Calls `vibehack_expand` one or more times. Each child requires a `falsifier` (the tool throws on missing falsifier for non-root nodes).
- Each call appends a `node_add` event.
- Re-renders `tree.md`.

**Examples:**
```
/expand n_3a
/expand n_1                  # add a sibling surface
```

**Common operator mistakes:**
- Expanding past breadth limit (8) → tool throws. The Planner system prompt knows to `/prune` first.
- Forgetting the falsifier — manual `/expand` calls inherit the Planner's discipline; the hook will reject empty falsifiers.

**Related:** [`/prune`](#prune-node-reason), [`/confirm`](#confirm-leaf).

---

### `/prune <node> [reason]`

**Syntax:** `/prune n_3b out of scope`
**Purpose:** Mark a branch pruned. The Planner won't expand under it.

**Frontmatter:**
```yaml
description: Prune a hypothesis-tree branch
model: test-planner
thinking: minimal
skill: planner-recipes
restore: true
```

**Side effects:**
- Appends `node_prune` event with the rationale.
- The `prune-dead-branches` DCP rule will start dropping artifacts under it from working context.

**Examples:**
```
/prune n_3b out of scope
/prune n_4a too noisy, costing budget without confidence gain
```

**Related:** [`/expand`](#expand-node), [`/vibehack-chain-reject`](#vibehack-chain-reject).

---

### `/confirm <leaf>`

**Syntax:** `/confirm n_4a`
**Purpose:** Spawn the Operator subprocess to test a leaf. Per-leaf reporter auto-spawns on confirmation.

**Frontmatter:**
```yaml
description: Confirm a leaf vulnerable; spawn per-leaf reporter
model: claude-opus-4-7
thinking: high
skill: operator-recipes
subagent: vibehack-operator
inheritContext: false
restore: true
```

**Side effects:**
- Spawns `pi --mode json -p --no-session` Operator subprocess with the structured input contract.
- Operator returns schema-validated JSON; the `tool_result` hook folds the result into the tree, runs negative-space synthesis, and triggers the per-leaf Reporter on confirmed outcomes.
- Operator subprocess inherits PATH shim for ingested tools ([commit `ae3fb1e`](../RESUME.md)).
- `graphify update` runs on engagement-local + global graphs.

**Examples:**
```
/confirm n_4a
```

**Common operator mistakes:**
- Running on a non-leaf node — the tool will refuse. Use `/expand` first to drive to a leaf.
- Aborting mid-Operator with `Ctrl+C` — pi-mono doesn't yet support graceful subprocess abort. The subprocess may complete and emit its event after you thought you stopped it. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#subprocess-hangs--timeouts).

**Related:** [`/expand`](#expand-node), [`/vibehack-chain-confirm`](#vibehack-chain-confirm).

---

### `/steer <text>`

**Syntax:** `/steer focus on the GraphQL endpoint`
**Purpose:** Inject a free-text steering note into the next Planner turn.

**Frontmatter:**
```yaml
description: Inject a free-text steering note into the next Planner turn
model: test-planner
thinking: minimal
skill: planner-recipes
restore: true
```

**Side effects:**
- Writes `pending-steer.txt` (one steer at a time; second `/steer` replaces).
- Appends a `steer` event to `events.jsonl`.
- The steer is injected into the **next** `before_agent_start` system prompt as a `<steer>...</steer>` block, then cleared.

**Examples:**
```
/steer focus on the GraphQL endpoint
/steer deprioritize OAuth, the client doesn't have it
/steer pivot to the admin subdomain
```

**Common operator mistakes:**
- Expecting immediate effect → it's next-turn. Mid-turn injection breaks tool-call boundaries.
- Stacking `/steer` calls → only the latest takes effect (the file is replaced, not appended). Use `/vibehack-pin` for persistent guidance.

**Related:** [`/vibehack-pin`](#vibehack-pin).

---

## Knowledge & tooling

### `/vibehack-ingest`

**Syntax:**
```
/vibehack-ingest <cli-name|git-url|description>
/vibehack-ingest --inline "<inline spec>"
/vibehack-ingest --specialist <kind>
/vibehack-ingest <description> --validate-against <url|file>
```

**Purpose:** Extend pi-vibehack's tool surface in 4 modes: existing CLI, git repo, on-the-fly synthesis, inline spec. Optionally draft a specialist skill.

**Frontmatter:**
```yaml
description: Ingest a tool (CLI, repo, name+description, or inline spec); optionally a specialist skill
model: test-operator
thinking: xhigh
skill: ingest-recipes
restore: true
```

**Modes (auto-detected by `prompts/vibehack-ingest.md`):**

| Mode | Trigger | Behavior |
|---|---|---|
| CLI | `which $1` succeeds | Run `--help`, draft a recipe SKILL.md. |
| Repo | `$1` looks like a git URL | Clone to `~/.pi/agent/vibehack/tools/<slug>/`, read README + `--help`. |
| Specialist | `--specialist <kind>` flag | Draft `~/.pi/agent/vibehack/specialists/learned/<kind>/SKILL.md` with frontmatter validation. |
| Inline | `--inline` flag | Operator-authored brief. Synthesize tool from scratch. |
| Synthesis | else | Search/propose/write/validate/ship a tool from scratch. |

**Validation gate (modes 3 + 5):**
- Default: `--help` exit code 0.
- With `--validate-against <target>`: run tool against target, sanity-check output is non-empty.
- Failed validation rolls back the `tools/<name>/` directory.

**Side effects:**
- Creates `tools/<slug>/` or `specialists/learned/<kind>/`.
- Updates `tools/PATH-shim.sh` (prepended for spawned subprocesses only).
- Appends `vibehack_tool` event to `events.jsonl`.
- graphify indexes the new tool for cross-engagement recall.

**Examples:**
```
/vibehack-ingest subfinder
/vibehack-ingest https://github.com/projectdiscovery/katana
/vibehack-ingest "wayback URL collector that paginates" --validate-against http://localhost:9999/echo
/vibehack-ingest --inline "tool that fuzzes path-traversal with double-URL-encoding"
/vibehack-ingest --specialist phishing
```

**Common operator mistakes:**
- Running synthesis without `--validate-against` on a non-trivial tool — defaults to `--help` which is too permissive. Provide a real target.
- Running `--specialist` mid-engagement — works, but `/reload` is required to pick up the new SKILL.md.

**Related:** [`/vibehack-distill`](#vibehack-distill).

---

### `/vibehack-distill`

**Syntax:** `/vibehack-distill` or `/vibehack-distill --specialists`
**Purpose:** Distill (situation, action, outcome) lessons from recent engagements into refined SKILL.md files.

**Frontmatter:**
```yaml
description: Distill (situation, action, outcome) lessons from recent engagements
model: test-planner
thinking: medium
skill: distill-recipes
restore: true
```

**Side effects:**
- Reads the last 3 engagements' `events.jsonl`.
- Writes refined recipe files to `skills/learned/`.
- With `--specialists`: refines `skills/specialists/<kind>/SKILL.md` based on which kinds appeared in successful confirmations.
- Hot-reload requires `/reload` after.

**Examples:**
```
/vibehack-distill
/vibehack-distill --specialists
```

**Related:** [`/vibehack-ingest`](#vibehack-ingest).

---

### `/vibehack-tree`

**Syntax:** `/vibehack-tree`
**Purpose:** Open the fullscreen tree viewer for the active engagement.

**Frontmatter:**
```yaml
description: Open the fullscreen hypothesis-tree viewer
restore: false
```

**Side effects:**
- None. Read-only.
- Handled by `extensions/pi-vibehack/ui/tree-viewer.ts` (the prompt body is unused; `restore: false` because there's no LLM call).

**Examples:**
```
/vibehack-tree
```

**Related:** [`/vibehack-cost`](#vibehack-cost).

---

## Chain control

### `/vibehack-chain-confirm`

**Syntax:** `/vibehack-chain-confirm` or `/vibehack-chain-confirm --interactive`
**Purpose:** Confirm and run the most recent proposed exploit chain. Step-by-step with `--interactive`.

**Frontmatter:**
```yaml
description: Confirm a proposed exploit chain; run sequentially (or step-by-step with --interactive)
model: test-operator
thinking: high
skill: operator-recipes
subagent: vibehack-operator
inheritContext: false
restore: true
```

**Side effects:**
- Implementation: `extensions/pi-vibehack/lib/chain-runner.ts`. Iterates the chain proposal's steps.
- Each step writes to `poc/<node_id>/`.
- Halts on the first falsified step (no skip-and-continue).
- With `--interactive`: calls `ctx.ui.confirm(...)` between steps.
- Returns per-step structured output.

**Examples:**
```
/vibehack-chain-confirm
/vibehack-chain-confirm --interactive
```

**Common operator mistakes:**
- Running without `--interactive` on a destructive chain → may execute privilege-escalation steps you wanted to gate. Default to `--interactive` for any chain crossing a trust boundary.
- Expecting auto-confirm for read-only chains → not in v1.0; every chain is explicit-confirmed.

**Related:** [`/vibehack-chain-reject`](#vibehack-chain-reject).

---

### `/vibehack-chain-reject`

**Syntax:** `/vibehack-chain-reject [reason]`
**Purpose:** Reject the most recent proposed chain.

**Frontmatter:**
```yaml
description: Reject a proposed exploit chain
model: test-planner
thinking: minimal
skill: planner-recipes
restore: true
```

**Side effects:**
- Implementation: `extensions/pi-vibehack/index.ts:156`.
- Appends `chain_reject` event with the reason.
- Marks the chain root node pruned.

**Examples:**
```
/vibehack-chain-reject too noisy
/vibehack-chain-reject out of scope per RoE
```

**Related:** [`/vibehack-chain-confirm`](#vibehack-chain-confirm), [`/prune`](#prune-node-reason).

---

## Meta

### `/vibehack-cost`

**Syntax:** `/vibehack-cost`
**Purpose:** Print a cost readout for the active engagement.

**Frontmatter:**
```yaml
description: Print a cost readout for the active engagement
restore: false
```

**Side effects:**
- Implementation: `extensions/pi-vibehack/index.ts:43`. Reads `events.jsonl`, sums `cost_usd`, breaks down by tool.
- No LLM call; `restore: false`.

**Examples:**
```
/vibehack-cost
```

Output:
```
Engagement 2026-05-02-target-example: $1.2347
  bash: $0.8210
  vibehack_confirm: $0.3120
  vibehack_recall: $0.0917
```

**Related:** [`/vibehack-tree`](#vibehack-tree).

---

### `/vibehack-update`

**Syntax:** `/vibehack-update`
**Purpose:** Pull the latest `@m4xx101/vibeshack` from npm and re-run install. Preserves config + hand-edits + engagement data.

**Frontmatter:**
```yaml
description: Update pi-vibehack to the latest version (preserves config + hand-edits + engagement data)
model: claude-haiku-4-5
```

**What it does:**
1. Runs `pi-vibehack update` — equivalent to `npm install -g @m4xx101/vibeshack@latest && pi-vibehack install`
2. Re-execs the freshly-installed binary so the NEW version's install logic runs (not the stale loaded one)
3. Preflight pi-dcp gets re-pinned to its current exact version
4. Prompt frontmatter regenerated from current `config.yaml.models` — hand-edits to non-`model:` lines are preserved
5. After completion, restart pi or `/reload` to load the new version

**What it preserves:**
- `~/.pi/agent/vibehack/config.yaml`
- Hand-edited prompt frontmatter (only the `model:` line gets rewritten by role)
- `~/.pi/agent/vibehack/engagements/` — all engagement events.jsonl + AGENTS.md + evidence
- `~/.pi/agent/vibehack/skills/learned/` — Layer B refined recipes (operator-owned files protected)
- `~/.pi/agent/vibehack/.capabilities.json` — Kali tool cache

**Equivalent shell command:**
```bash
pi-vibehack update                # one-shot
pi-vibehack --version             # check current version
```

**Examples:**
```
/vibehack-update
```

---

## Soft-companion

### `/vibehack-pin`

**Syntax:** `/vibehack-pin <fact>` or `/vibehack-pin --global <fact>`
**Purpose:** Pin a fact to the engagement (or global) AGENTS.md. Loaded at every `before_agent_start`.

**Frontmatter:**
```yaml
description: Pin a fact to the engagement (or global) AGENTS.md (requires memory-mode soft companion)
restore: false
```

**Side effects:**
- Implementation: `extensions/pi-vibehack/index.ts:73`. Falls back to direct AGENTS.md append if memory-mode isn't installed (the spec called for memory-mode, the implementation doesn't strictly require it — it's a soft companion).
- Writes timestamped line to `engagements/<id>/AGENTS.md` (engagement-scoped) or `~/.pi/agent/vibehack/AGENTS.md` (`--global`).

**Examples:**
```
/vibehack-pin out-of-scope: *.staging.target.com
/vibehack-pin --global prefer Tor for OSINT
```

**Common operator mistakes:**
- Pinning at engagement-scope when you wanted global → re-run with `--global`. Old entries persist; remove manually if needed.

**Related:** [`/steer`](#steer-text).

---

### `/vibehack-handoff`

**Syntax:** `/vibehack-handoff [engagement-id]`
**Purpose:** Generate a hand-off prompt for cross-session or cross-operator transfer.

**Frontmatter:**
```yaml
description: Generate a hand-off prompt for cross-session or cross-engagement transfer
model: test-planner
thinking: low
skill: planner-recipes
restore: true
```

**Side effects:**
- Implementation: `extensions/pi-vibehack/index.ts:90`. Reads events, folds nodes, lists open hypotheses with their `next_test`.
- Writes `engagements/<id>/handoff.md` and prints to stdout.

**Examples:**
```
/vibehack-handoff
/vibehack-handoff 2026-04-29-acme-example
```

**Related:** [`/vibehack-pause`](#vibehack-pause), [`/vibehack-resume`](#vibehack-resume).

---

## Provider personas

These are *not* slash commands — they're system-prompt fragments in `prompts/personas/` selected at `before_agent_start` based on pi's active provider. The persona is prepended to the Planner system prompt.

### CLAUDE.md
For Anthropic Claude providers. Emphasizes structured reasoning, falsifier articulation, hypothesis-or-die discipline. Encourages early `vibehack_recall` use.

### CODEX.md
For OpenAI/Codex providers. Biases toward action over explanation: "do not explain — mutate. The tree shows your work." Validation discipline: every confirmed leaf needs an evidence ref.

### GEMINI.md
For Gemini providers. Pins literal-StringEnum semantics. Reminds the Planner that the wire-layer auto-injects recall (it doesn't need to call `vibehack_recall` for every turn). One mutation per turn.

### LOCAL.md
For local models (Qwen / Llama / Gemma class). Strict structured-output contract. Terse rationales (≤ 80 tokens — local models drift on long ones). One mutation per turn, no chained tool calls. Calls `vibehack_recall` first when unsure.

Persona detection: `extensions/pi-vibehack/lib/persona.ts`. Reads pi's active provider; matches by prefix; defaults to `LOCAL.md` if no match.

---

## v1.1 commands

Added in v1.1.0-rc1 alongside the self-evolving harness, Kali auto-discovery, browser verifier, and canary primitives.

### `/vibehack-config sync`

**Syntax:** `/vibehack-config sync`
**Purpose:** Regenerate slash-command frontmatter (`model:` / `thinking:`) from `~/.pi/agent/vibehack/config.yaml` without clobbering hand-edited prompt bodies. *(Landed in v1.0.1; documented here for completeness.)*

**Side effects:** Re-writes the YAML frontmatter block of every `prompts/*.md` shipped with the harness. Operator-edited prompt bodies (below the frontmatter) are preserved.

---

### `/vibehack-reflect`

**Syntax:** `/vibehack-reflect`
**Purpose:** Manually trigger Layer B reflection. Clusters confirmed leaves across recent engagements by stack signature (target type, recipe family, evidence shape) and writes refined recipes to `~/.pi/agent/vibehack/skills/learned/<slug>/SKILL.md`.

**Side effects:**
- Implementation: `extensions/pi-vibehack/lib/reflection.ts`. Auto-fires on `session_before_compact` and `/vibehack-complete`; manual via this command.
- Operator-edited recipes (detected by trailing-edit signature) are skipped — never clobbered.
- Hot-reload requires `/reload` after.

---

### `/vibehack-evolve --bench <name> [--mutate]`

**Syntax:** `/vibehack-evolve --bench example` or `/vibehack-evolve --bench example --mutate`
**Purpose:** Run a Layer A bench evaluation. Without `--mutate`, runs `bench/<name>/up.sh` → spawns engagement → evaluates against `bench/<name>/expected-findings.yaml` → runs `down.sh` → produces a results report. With `--mutate`, additionally spawns the `vibehack-mutator` subagent in a git worktree; mutation lands only if the target bench passes AND the regression suite stays green.

**Side effects:**
- Without `--mutate`: writes a results report under the engagement directory; no harness changes.
- With `--mutate`: creates an isolated worktree, runs the mutator subagent, then merges back only on regression-pass. Path-safe + typebox-validated. Falsified mutations are discarded with the worktree.

---

### `/vibehack-rescan-kali`

**Syntax:** `/vibehack-rescan-kali`
**Purpose:** Force a re-scan of installed Kali tool capabilities. Refreshes `~/.pi/agent/vibehack/.capabilities.json`.

**Side effects:** Re-runs `detectKaliCapabilities()` from `extensions/pi-vibehack/lib/kali-tools.ts`. Operator-pinned tool overrides are preserved.

---

### `/vibehack-rewind` *(soft — requires pi-rewind-hook)*

**Syntax:** `/vibehack-rewind`
**Purpose:** Step the Planner state back one mutation. No-op when `pi-rewind-hook` is not installed (banner explains).

---

### `/vibehack-fork` *(soft — requires pi-side-chat)*

**Syntax:** `/vibehack-fork`
**Purpose:** Branch the current engagement into a side-chat without losing the main thread. No-op when `pi-side-chat` is not installed.

---

## v1.1 Planner tool — `vibehack_canary_verify`

**Signature:** `vibehack_canary_verify(node_id: string, kind: "rce" | "afr" | "ssrf" | "open-redirect" | "blind-oob" | "dns")`

**Purpose:** Plants a deterministic canary appropriate to the vulnerability class, then verifies retrieval. Emits `canary_planted` events; on retrieval the `tool_result` hook emits `verification_pass`.

| `kind` | Primitive | Notes |
|---|---|---|
| `rce` | filesystem canary | tempfile written; verified by Operator subprocess reading the same path on the target |
| `afr` | filesystem canary | arbitrary-file-read; canary content is a unique nonce |
| `ssrf` | HTTP callback | ephemeral local port (`:0`); listener URL injected into payload |
| `open-redirect` | HTTP callback | follow chain expected to land on listener URL |
| `blind-oob` | operator-pinned collector | requires `/vibehack-pin canary-collector: <url>` (e.g. interactsh subdomain) |
| `dns` | operator-pinned collector | DNS subdomain probe; same OOB collector requirement as blind-oob |

**OOB collector pinning:** `blind-oob` and `dns` kinds require an operator-pinned collector URL. Without it, the tool emits a `verification_advisory` instead. Pin via:

```
/vibehack-pin canary-collector: https://abcde.oast.online
```

Cleanup runs at `/vibehack-complete` (best-effort; ephemeral listeners are torn down, filesystem canaries are removed when accessible).

---

## Command order in normal flow

1. `/vibehack <target>` — start.
2. `/vibehack-tree` (read), `/steer` (when needed), `/expand|/prune|/confirm` (manual override).
3. `/vibehack-chain-confirm` or `/vibehack-chain-reject` when proposals appear.
4. `/vibehack-pin` for facts that should persist within the engagement.
5. `/vibehack-ingest` when you need a tool that doesn't exist yet.
6. `/vibehack-pause` when stopping mid-engagement.
7. `/vibehack-resume` to come back.
8. `/vibehack-complete` to wrap.
9. `/vibehack-distill` post-engagement to compound learnings.
10. `/vibehack-cost` and `/vibehack-update` ad-hoc.
