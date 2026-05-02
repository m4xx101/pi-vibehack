# Operator Guide

The pi-vibehack daily-use manual.

> **Authorized testing only.** You are responsible for scope, authorization, and signed agreements. The harness has unleashed scope by design — `audit.log` is your forensic record. See [SECURITY.md](SECURITY.md).

---

## Table of contents

1. [Mental model](#mental-model)
2. [Starting an engagement](#starting-an-engagement)
3. [Reading the tree](#reading-the-tree)
4. [The proactive loop](#the-proactive-loop)
5. [Steering](#steering)
6. [Tree verbs (manual)](#tree-verbs-manual-override)
7. [Auth walls](#auth-walls)
8. [Browser leaves](#browser-leaves)
9. [Exploit chains](#exploit-chains)
10. [Specialists](#specialists)
11. [Tool ingest (the matrix-glitch)](#tool-ingest-the-matrix-glitch)
12. [Pinning facts](#pinning-facts)
13. [Cross-engagement memory](#cross-engagement-memory)
14. [Pause / resume / handoff](#pause--resume--handoff)
15. [Wrapping up](#wrapping-up)
16. [Cost watching](#cost-watching)
17. [Authorized testing only](#authorized-testing-only)

---

## Mental model

Three roles, one loop, one tree.

**You are the steerer.** You set scope, type `/vibehack <target>`, intervene with `/steer` when the agent goes sideways, and decide when to confirm a leaf, gate a chain, or call it done. You do not run commands; the harness does.

**The Planner is the strategist.** It lives in your pi window. Its only job is to mutate the hypothesis tree — `vibehack_expand`, `_prune`, `_confirm`, `_evidence`, `_dead_end`, `_propose_chain`, `_propose_specialist`, `_recall`. It has `read` and `grep` but no bash. It cannot execute. It is forced by hooks to mutate every turn (the *hypothesis-or-die* invariant) and to attach a falsifier to every expansion (the *falsifier-required* invariant). See [ARCHITECTURE.md §Loop invariants](ARCHITECTURE.md#loop-invariants).

**The Operator subprocess is the executor.** When you `/confirm <leaf>`, vibehack spawns `pi --mode json -p --no-session` with a structured input contract (the leaf's claim, next_test, falsifier, recipe hints, auth profiles). It runs bash + recipe skills + (when needed) browser tools. It returns schema-validated JSON. It never sees the Planner's transcript and the Planner never sees its raw stdout. This is **subprocess isolation** — your prompt-injection mitigation against malicious target output. See [ADR-0006](adr/0006-subprocess-isolation-for-untrusted-output.md).

**The Reporter subprocess is the scribe.** Two trigger modes: per-leaf (auto on `vibehack_confirm`, drafts `poc/<node_id>/poc.md`) and final (on `/vibehack-complete`, writes the full `report.md`). It reads only artifacts. It cannot execute or mutate the tree. ([ADR-0009](adr/0009-specialists-as-skills-not-subagents.md) — note: specialists are skills, not subagents; the Operator is the only subprocess kind aside from the Reporter.)

**The hypothesis tree is your working memory.** `events.jsonl` is the truth (append-only, replayable). `tree.md` is a folded view, re-rendered after every mutation. The Planner reads from `tree.md`, not from chat history. This means you can `Ctrl+C` mid-session, restart pi, `/vibehack-resume`, and the Planner picks up where it left off.

---

## Starting an engagement

```
/vibehack target.example
```

What happens at T+0:

1. The `/vibehack` prompt template fires (see [`prompts/vibehack.md`](../prompts/vibehack.md), frontmatter pins `claude-haiku-4-5, claude-sonnet-4-6` — first model that resolves wins).
2. The Planner calls `vibehack_expand` with `parent_id: null`, `kind: "root"`, `claim: "engagement: target.example"`, `falsifier: "n/a"`. This creates `~/.pi/agent/vibehack/engagements/2026-05-02-target-example/` and writes the first event to `events.jsonl`. The slug is NFKD-folded and trimmed; bare-symbol input becomes `"untargeted"` ([RESUME.md deviation #15](../RESUME.md)).
3. The Planner expands top-level surfaces (web, subdomains, API, email, third-party) — one `vibehack_expand` per surface, each with a sharp `falsifier`.
4. It picks the highest-confidence-gain surface and emits **one** hypothesis with a concrete `next_test` and `falsifier`.
5. Stops. Awaits your steer.

The status banner now reads something like `🌳 7 nodes · 0 confirmed · $0.0034 · /vibehack-tree`.

---

## Reading the tree

```
/vibehack-tree
```

Opens the fullscreen viewer (`extensions/pi-vibehack/ui/tree-viewer.ts`). Read-only. Press `q` to close.

### Emoji legend

| Emoji | Meaning | Source field |
|---|---|---|
| 🌳 | open hypothesis | `status: "open"` |
| ⏳ | in-flight (Operator subprocess running) | `status: "in-flight"` |
| ✅ | confirmed (leaf vulnerable) | `status: "confirmed"` |
| ✂️ | pruned (operator/Planner skipped) | `status: "pruned"` |
| 💀 | dead-end (Planner gave up) | `status: "dead"` |
| 🌐 | requires browser | `requires_browser: true` |
| 📎 | evidence attached | evidence count > 0 |
| ⚪ | synthetic evidence (negative-space) | `synthetic: true` |
| ❓ | unmapped status (schema added one without updating `STATUS_EMOJI`) | fallback ([RESUME.md deviation #10](../RESUME.md)) |
| ⚠️ | cycle detected at this node | `renderTreeMd` cycle guard fired ([RESUME.md deviation #9](../RESUME.md)) |

`tree.md` is rendered deterministically — sorted-key cost rollup, cycle guard via `visited: Set<string>`, orphan event handling that warns rather than crashes ([RESUME.md deviations #7-9](../RESUME.md)).

---

## The proactive loop

You don't normally type tree commands. The Planner is proactive:

1. Each turn, the `before_provider_request` hook reads the current open hypotheses, scores them (kind weight × confidence), picks the top, and queries the global graphify graph for top-3 most-relevant subgraphs. These are silently injected into the system prompt as a `<recall>` block. ([ARCHITECTURE.md §The 10× move](ARCHITECTURE.md#the-10x-move))
2. The Planner reads `tree.md` (not from memory — invariant), picks the highest-confidence-gain open node, and emits one mutation.
3. The `tool_call` hook writes to `audit.log`. The `tool_result` hook runs negative-space synthesis on the result (HTTP header diff vs CSP/HSTS/X-Frame-Options/SameSite/Permissions-Policy/Referrer-Policy; nmap port output vs common-port baseline; DNS records vs SPF/DKIM/DMARC). Misses become *synthetic evidence events* with `synthetic: true`. The Planner sees them next turn without asking.
4. After every `confirm` and `evidence_add`, `graphify update` runs on both the engagement-local and global graphs ([RESUME.md commit `ab384e8`](../RESUME.md)).
5. If a turn produces no mutation, the next `before_agent_start` injects: `[VIBEHACK INVARIANT] Last turn produced no tree mutation. Emit one or call vibehack_dead_end <node> to mark stuck.` Hypothesis-or-die.

When you see the Planner stuck pinging `[VIBEHACK INVARIANT]` repeatedly, intervene with `/steer` or hard-prune.

---

## Steering

```
/steer focus on the GraphQL endpoint
/steer deprioritize OAuth, the client doesn't have it
/steer pivot to the admin subdomain we found
```

The `/steer` command is implemented in `extensions/pi-vibehack/index.ts:137`. It writes a `pending-steer.txt` (via `lib/pending-steer.ts`) and appends a `steer` event to `events.jsonl`. On the **next** `before_agent_start`, the steer is injected as a `<steer>...</steer>` block in the system prompt. The Planner reprioritizes naturally — it does not interrupt the current turn ([RESUME.md commit `1baf3db`](../RESUME.md)).

Why next-turn rather than immediate? Mid-turn injection breaks pi-mono's tool-call boundaries and corrupts the JSONL log. Next-turn is safe and the Planner is short-cycle enough that the latency is negligible.

---

## Tree verbs (manual override)

```
/expand n_3a                          # add children under n_3a
/prune n_3b out of scope              # mark a branch pruned
/confirm n_4a                         # spawn Operator on a leaf
```

These are escape hatches. In normal operation, the Planner is doing all three on its own. Use the manual verbs when:

- You see the Planner missing a hypothesis you have intuition for → `/expand <parent>` then steer toward the area.
- A branch is consuming budget and is clearly out of scope → `/prune <node> <reason>`.
- A leaf is hot and you want it tested *now* without waiting for the Planner's natural pickup → `/confirm <leaf>`.

`/expand <node>` requires a falsifier on every child it creates (the tool throws on missing/empty falsifier for non-root nodes — see `tools/expand.ts:24`). The breadth limit is 8; the tree-id generator throws on siblingCount ≥ 26 as a defensive bound ([RESUME.md deviation #11](../RESUME.md)).

If `/expand` fails with a breadth-limit error, the Planner system prompt knows to call `/prune` first.

---

## Auth walls

When an Operator subprocess hits an auth wall — bearer scope, CSRF token, OAuth callback — it returns:

```json
{
  "node_id": "n_5b",
  "outcome": "blocked-on-auth",
  "scurl_template_request": "csrf-replay",
  "auth_state_changes": {},
  "handoff_summary": "Need a fresh CSRF token captured from the browser session."
}
```

The flow (with `pi-super-curl` installed):

```
Operator returns blocked-on-auth + scurl_template_request
        │
        ▼
Planner detects → fires /scurl csrf-replay
        │
        ▼
scurl TUI opens with the template fields pre-filled
        │
        ▼
Operator (you) paste the captured token / cookie / header value
        │
        ▼
sendToAgent flag flows the value back
        │
        ▼
Operator subprocess respawned with the new auth profile
        │
        ▼
Resumes execution against n_5b
```

The three ship templates are:

- **`auth-bearer-probe`** — probe an endpoint with a bearer token and surface the response.
- **`jwt-tamper`** — modify a JWT (alg=none, key confusion, expired-ts) and replay.
- **`csrf-replay`** — replay a request with a captured CSRF token + cookie.

See [RECIPES.md §scurl templates](RECIPES.md#scurl-templates) for the JSON shapes.

Without `pi-super-curl`, the Operator can still report `blocked-on-auth`; you fix the auth manually, then `/confirm <leaf>` to retry.

---

## Browser leaves

A hypothesis with `requires_browser: true` is one that depends on JS execution / SPA / OAuth flow / DOM events / drag-drop. The Planner sets this when it expands the node.

When you `/confirm <leaf>` on such a node:

1. The `lib/operator-spawn.ts` builder injects browser recipe hints into the input contract (see `lib/browser-bridge.ts`).
2. With `surf-cli` on PATH → `surf-cli` recipe loads.
3. Without `surf-cli` but with `npx playwright` available → `playwright-cli` recipe loads as fallback.
4. The Operator subprocess gets browser tools enabled.
5. Action sequences are recorded to `engagements/<id>/poc/<node_id>/browser.jsonl`.

Browser-touched leaves are marked `replay: best-effort` — the PoC includes both the action sequence and a curl approximation when feasible.

See [RECIPES.md §surf-cli](RECIPES.md#surf-cli) and [§playwright-cli](RECIPES.md#playwright-cli).

---

## Exploit chains

When the Planner sees an opportunity to chain (entry vuln → post-ex → lateral), it calls `vibehack_propose_chain`. The status banner updates:

```
🌳 12 nodes · 2 confirmed · $0.42 · ⚠ chain proposed: n_3b → n_4a → n_5c
   /vibehack-chain-confirm or /vibehack-chain-reject
```

Confirm modes:

```
/vibehack-chain-confirm                # run all steps sequentially
/vibehack-chain-confirm --interactive  # halt before each step for confirmation
/vibehack-chain-reject too noisy       # prune the proposal
```

Implementation: `extensions/pi-vibehack/lib/chain-runner.ts`. With `--interactive`, the runner calls `ctx.ui.confirm("Run next chain step?", ...)` between each step. Without it, runs sequentially until completion or first falsified step (chains halt on the first falsified outcome — there's no "skip and continue").

**Default is *every chain confirmed*.** Pi-vibehack does **not** auto-confirm any chain by default. The `/vibehack-config auto-chain-readonly true` toggle (mentioned in spec §6.1 Goal 6) is reserved for a future release — current v1.0 ships explicit-confirm-only.

When to gate vs run sequentially:

- **Gate (`--interactive`)**: any chain step marked `is_destructive: true`, any chain that crosses a trust boundary (privilege escalation, lateral movement), any chain with a step that costs > $1.
- **Run sequentially**: read-only enumeration chains, evidence-gathering chains.

`/vibehack-chain-reject` writes a `chain_reject` event and marks the proposal root pruned. The Planner sees the rejection on its next turn and pivots.

---

## Specialists

Specialists are *skills* (single SKILL.md files), not subagents. The Operator subprocess loads a specialist's SKILL.md via `lib/specialist-loader.ts` when the Planner calls `vibehack_propose_specialist(node_id, kind)`. ([ADR-0009](adr/0009-specialists-as-skills-not-subagents.md))

### When to use

You don't normally invoke specialists directly — the Planner does it when a hypothesis matches a specialist's discipline. Use the prompt-level escape hatches if you want to force one:

```
/expand n_4a    # then steer "use the binary-recon specialist"
```

### The 5 shipped specialists

| Specialist | Discipline | Falsifier tells |
|---|---|---|
| `web-recon` | Subdomain enum, tech fingerprint, surface mapping | "no subdomains beyond apex", "tech stack matches apex" |
| `web-exploit` | Web vuln exploitation: SQLi, SSRF, IDOR, deserialization | "non-200 on payload", "no oracle in response" |
| `binary-recon` | Binary triage: file/strings/checksec/sym tables | "PIE+RELRO+canary all on", "no symbols leaked" |
| `auth-bypass` | Auth schema attacks: JWT, OAuth, session | "signature verification rejects tampered token" |
| `osint` | Public-source intel: GitHub, certs, paste sites | "no exposed secrets in last 90d commits" |

Each is in `skills/specialists/<kind>/SKILL.md`. See [RECIPES.md §Specialists](RECIPES.md#specialist-skills) for the full breakdown.

### Growing your own

```
/vibehack-ingest --specialist phishing
```

Implementation: `lib/specialist-ingest.ts`. The ingest spawns an Operator subprocess (frontier, xhigh thinking) that drafts a `SKILL.md` with frontmatter validation, lands it at `~/.pi/agent/vibehack/specialists/learned/phishing/SKILL.md`. Frontmatter is validated before the file lands — invalid drafts roll back ([RESUME.md commit `61b3c54`](../RESUME.md)).

Loader precedence: shipped (`skills/specialists/<kind>/`) wins over learned (`~/.pi/agent/vibehack/specialists/learned/<kind>/`) when names collide.

---

## Tool ingest (the matrix-glitch)

The single most differentiating capability of pi-vibehack: `/vibehack-ingest` extends your capabilities mid-engagement, in four modes.

### Mode 1: CLI on PATH

```
/vibehack-ingest subfinder
```

`which subfinder` succeeds → ingest runs `subfinder --help`, drafts a recipe SKILL.md, lands it under `skills/learned/recipes/subfinder/SKILL.md`. `/reload` to pick up.

### Mode 2: Public git repo

```
/vibehack-ingest https://github.com/projectdiscovery/katana
```

Detected as git URL → clones to `~/.pi/agent/vibehack/tools/katana/`, reads README + `--help`, drafts recipe + install/build steps. The PATH shim (`tools/PATH-shim.sh`) prepends `tools/<slug>/bin` for Operator subprocess spawns only — does not pollute your interactive shell.

### Mode 3: Synthesis (write the tool from scratch)

```
/vibehack-ingest "wayback URL collector that paginates and dedupes by host" \
  --validate-against http://localhost:9999/echo
```

This is the matrix-glitch. The Operator subprocess (frontier, `thinking: xhigh`) searches, proposes, writes, tests a Python or Go tool from scratch into `tools/<slug>/`. The `--validate-against` target is run before the tool lands; on non-empty sane output, ship; on failure, **roll back the directory**. If `--validate-against` is omitted, validation defaults to `--help` exit-code-zero.

Implementation: `lib/tool-ingest.ts`. The validation gate is what makes this safe — no broken tools land in your tools dir.

### Mode 4: Inline spec

```
/vibehack-ingest --inline "I need a tool that takes a URL and a wordlist, fuzzes path-traversal payloads with double-URL-encoding, and reports any 200 with a JSON body."
```

Same pipeline as Mode 3, but the operator-authored brief is the spec rather than a search-derived one.

### After ingest

`/reload` in pi to hot-load new skills. A `vibehack_tool` event is appended to `events.jsonl`; graphify indexes it; cross-engagement `<recall>` will surface "you wrote a wayback-paginate tool 2 weeks ago" when relevant.

---

## Pinning facts

```
/vibehack-pin out-of-scope: *.staging.target.com
/vibehack-pin --global prefer Tor for OSINT
```

`/vibehack-pin` writes to `engagements/<id>/AGENTS.md` (engagement-scoped) or `~/.pi/agent/vibehack/AGENTS.md` (`--global`). Implementation: `extensions/pi-vibehack/index.ts:73`. AGENTS.md is loaded by `before_agent_start`.

Engagement-scoped vs global:

- **Engagement-scoped**: scope notes, target-specific creds, "the staging admin is `staging-admin@target.com`", session-specific exclusions.
- **Global**: cross-engagement preferences ("always probe `/.git/HEAD` on first contact"), tool defaults ("prefer Tor for OSINT phases"), persona modifications.

Use engagement-scoped liberally; the `prune-folded-evidence` DCP rule keeps it from bloating context.

---

## Cross-engagement memory

Two mechanisms compound across engagements:

**`lessons.jsonl`** — `(situation, action, outcome)` triples extracted at compact-time by `session_before_compact`. Loaded at `session_start` and exposed to the Planner as a grep-able skill. `/vibehack-distill` reads the last 3 engagements' events.jsonl and synthesizes refined `skills/learned/` entries.

**Global graphify graph** — `~/.pi/agent/vibehack/graph/`. Updated on every `confirm`/`evidence_add` ([RESUME.md commit `ab384e8`](../RESUME.md)). Queried by `before_provider_request` for the wire-layer `<recall>` injection. This is the substrate that makes engagement #N start smarter than #N-1.

The promise: **every engagement starts smarter**. Week 1 you bootstrap from zero. Week 4 your first turn against a new target lands `<recall>` hits like *"prior engagement found jboss/jboss default creds; 12% hit rate; suggested first probe"* — without you ever having read or queried that knowledge yourself.

---

## Pause / resume / handoff

```
/vibehack-pause                  # checkpoint, halt — emits a vibehack_evidence summary on root
/vibehack-resume [id]            # resume latest by default, or a specific engagement
/vibehack-handoff [id]           # generate a handoff prompt for cross-session/cross-operator
```

`/vibehack-pause` writes a summary `vibehack_evidence` event on the root node ("what's done, what's open, what to do next when resumed") and stops. The engagement is not closed — `tree.md` and `events.jsonl` stay intact.

`/vibehack-resume` reads `tree.md`, picks the highest-confidence-gain open node, emits one mutation, then stops. Effectively a one-turn replay primer.

`/vibehack-handoff` is the cross-operator escape: it writes `engagements/<id>/handoff.md` with open hypotheses + recent evidence + active auth profiles + recommended next test. Hand the directory to a teammate; they `/vibehack-resume <id>` on their machine and pick up.

For long engagements, use `/vibehack-pause` between sessions and `/vibehack-resume` to come back. Don't rely on pi-mono session restore — `events.jsonl` is the truth, the chat history is incidental.

---

## Wrapping up

```
/vibehack-complete
```

Spawns the final Reporter subprocess (`prompts/vibehack-complete.md`, frontmatter pins `claude-opus-4-7` thinking high). It reads `events.jsonl`, `tree.md`, every `poc/<node_id>/poc.md`, and `AGENTS.md`. Writes `engagements/<id>/report.md` with:

- Exec summary
- Findings table (severity, asset, claim, evidence ref)
- Full PoCs (per leaf: replayable artifact + reproduction steps)
- Remediation per finding
- IoC table
- Timeline
- Cost ledger

Returns: `{"report_path": "report.md", "finding_count": N, "total_cost_usd": X}`.

The per-leaf reporter has already been auto-spawned at every `vibehack_confirm` (see `lib/reporter-spawn.ts` and [RESUME.md commit `a14f384`](../RESUME.md)). The final reporter aggregates those writeups.

```
/vibehack-distill
/vibehack-distill --specialists
```

Reads the last 3 engagements' events.jsonl, extracts recurring patterns, writes refined SKILL.md files into `skills/learned/`. With `--specialists`, refines `skills/specialists/<kind>/SKILL.md` based on which specialist kinds were used in successful confirmations. `/reload` after.

---

## Cost watching

Cost is metadata, never a gate (loop invariant #6, [ARCHITECTURE.md](ARCHITECTURE.md#loop-invariants)). The status banner shows the running total. To inspect:

```
/vibehack-cost
```

Implementation: `extensions/pi-vibehack/index.ts:43`. Reads `events.jsonl`, sums `cost_usd` per event, breaks down by tool. Prints:

```
Engagement 2026-05-02-juice-shop-local: $1.2347
  bash: $0.8210
  vibehack_confirm: $0.3120
  vibehack_recall: $0.0917
  vibehack_expand: $0.0100
```

Per-leaf budgets are advisory — there's no hard cap. Long chains can run cost away; use `/vibehack-chain-confirm --interactive` for chains where you want a checkpoint.

---

## Authorized testing only

The harness has unleashed scope by design ([ADR-0007](adr/0007-unleashed-scope.md)). It will probe what you tell it to probe. **You are responsible** for:

- Confirming the target is in scope.
- Holding signed authorization (bug bounty program rules / pentest agreement / lab ownership).
- Respecting rate limits and exclusions.
- Reading [SECURITY.md](SECURITY.md) before your first engagement.

The `audit.log` at `~/.pi/agent/vibehack/engagements/<id>/audit.log` is the forensic record. If something goes sideways — a stray scan against an unintended IP, a destructive payload landing on a prod system — `audit.log` is what you have to explain what happened. Keep it.

If you're not sure whether a target is authorized, **don't run the engagement**.
