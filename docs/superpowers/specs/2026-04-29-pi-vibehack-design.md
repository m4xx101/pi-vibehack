# pi-vibehack — Design Specification

**Status:** Locked design (pending implementation plan)
**Date:** 2026-04-29
**Author:** m4xx101
**Target runtime:** [pi-mono](https://github.com/badlogic/pi-mono) (`@mariozechner/pi-coding-agent`)
**Package:** `@m4xx101/pi-vibehack`
**License:** MIT

---

## 1. Identity

**Name:** `pi-vibehack`. Slash command surface `/vibehack*`. Runtime data at `~/.pi/agent/vibehack/`.

**Tagline:** *Context-aware vibe-hacking on pi-mono — bug bounty, recon, enumeration, exploit, post-ex, lateral movement, pentest, CTF. Operator steers; the harness drives a live hypothesis tree at full potential, proactively aiding every phase from first packet to final report.*

**One-paragraph architecture:**
A single pi extension (`extensions/pi-vibehack/index.ts`) wires `session_start`, `before_agent_start`, `tool_call`, `tool_result`, `session_before_compact`, and `before_provider_request` plus four `pi-dcp` rules. The main pi session runs the **Planner** role — system prompt swapped via `before_agent_start`, tools restricted via `pi.setActiveTools`. The Planner mutates a hypothesis tree spanning the full kill chain (recon → enum → exploit → post-ex → lateral → report) by calling custom tools (`vibehack_expand`, `vibehack_prune`, `vibehack_confirm`, `vibehack_evidence`, `vibehack_recall`, `vibehack_dead_end`, `vibehack_propose_chain`, `vibehack_propose_specialist`); every call writes one event to `~/.pi/agent/vibehack/engagements/<id>/events.jsonl` via `pi.appendEntry` and re-renders `tree.md`. Proactivity is the loop invariant — the `tool_result` hook rejects turns that don't update or close a hypothesis. `/confirm <leaf>` spawns an **Operator** subprocess (`pi --mode json -p --no-session`) with bash + recipe skills + frontier model; it executes the leaf's `next_test`, returns structured evidence which folds into the tree. `/vibehack-complete` spawns a **Reporter** subprocess that reads the full event log + tree, writes `report.md` + `poc/` artifacts. Cross-session memory (`lessons.jsonl`) appended by `session_before_compact`, loaded by `session_start`, exposed to the Planner as a grep-able skill — the harness teaches itself across engagements. Eight recipe skills bundle (curl/super-curl, httpx, nuclei, ffuf, searchsploit, nmap, surf-cli, playwright-cli); `/vibehack-ingest` extends in four modes (CLI on PATH, git repo, name+description with on-the-fly tool synthesis, inline spec). Five specialist skills bundle; `/vibehack-ingest --specialist` drafts new ones. **Negative-space recon** runs in the `tool_result` hook — missing CSP/HSTS/SameSite/filtered-ports become positive findings the Planner sees next turn without asking. The 10× move: graphify-backed live knowledge graph + `before_provider_request` wire-layer auto-injection of relevant subgraphs every Planner turn — the agent feels telepathic about prior engagements. No DB, no SQLite, no vector store. Unleashed scope, audit-log only. Three model profiles (`hybrid`/`local`/`frontier`) via `pi-prompt-template-model` frontmatter. Install: `npx -y @m4xx101/pi-vibehack install` writes one line to `~/.pi/agent/settings.json`.

---

## 2. The Hypothesis Tree (Data Model + Invariants)

This is the loop's spine. Everything else is plumbing around it.

### 2.1 Event schema

One JSONL line per mutation event in `events.jsonl`:

```json
{
  "ts": "2026-04-29T10:23:45.123Z",
  "engagement_id": "2026-04-29-acme-example",
  "event": "node_add | node_update | node_prune | evidence_add | confirm | steer | tool_call | tool_result | lesson | vibehack_tool | chain_propose | chain_confirm | chain_reject | specialist_propose | engagement_start | engagement_end",
  "node_id": "n_3a",
  "parent_id": "n_2",
  "kind": "root | surface | hypothesis | leaf",
  "phase": "recon | enum | exploit | post-ex | lateral | report",
  "claim": "human-readable hypothesis",
  "next_test": "what would falsify or confirm",
  "falsifier": "structured falsifier (required on expand)",
  "confidence": 0.0,
  "status": "open | in-flight | confirmed | pruned | dead",
  "requires_browser": false,
  "evidence": [{ "ts": "...", "kind": "...", "ref": "...", "summary": "...", "synthetic": false }],
  "cost_tokens": 0,
  "cost_usd": 0.0,
  "rationale": "why the planner did this",
  "metadata": {}
}
```

### 2.2 Folded views (computed on read, never stored as truth)

- `tree.md` — rendered after every mutation. Indented Markdown, status emojis, cost rollup per branch.
- `findings.md` — confirmed leaves only, with PoC links.
- `lessons.jsonl` projection — `(situation, action, outcome)` triples extracted at compact-time.

### 2.3 Loop invariants (enforced by hooks, not prompts)

1. **Hypothesis-or-die.** Every Planner turn must produce at least one of: `vibehack_expand`, `vibehack_prune`, `vibehack_confirm`, `vibehack_evidence`, `vibehack_dead_end`, `vibehack_propose_chain`, or `vibehack_propose_specialist`. If a turn ends without one, the next-turn `before_agent_start` injects: *"Last turn produced no tree mutation. Emit one or call `vibehack_dead_end <node>` to mark stuck."*
2. **Falsifier required.** `vibehack_expand` rejects nodes without a non-empty `falsifier` field. Forces scientific framing.
3. **Depth/breadth bounds.** Tree depth capped at 6 (recon → enum → hypothesis → sub-hyp → leaf → PoC). Breadth at any node capped at 8. Hitting either triggers a `prune-or-confirm` prompt.
4. **Negative-space synthesis.** `tool_result` hook diffs HTTP responses against expected-headers list (CSP/HSTS/X-Frame-Options/SameSite/Permissions-Policy/Referrer-Policy), nmap output against common-port baseline, DNS responses against expected records. Misses become *synthesized evidence events* tagged `synthetic: true`.
5. **Sub-agent context isolation.** Operator/Reporter subprocesses never see the Planner's transcript — only the typed input contract (§3). They return schema-validated structured JSON. Prevents target-output prompt-injection.
6. **Cost as metadata, never gate.** Every `tool_call` and LLM turn tags an event with `cost_usd`; status banner totals it; nothing blocks.

### 2.4 The 10× move — Live Knowledge Graph + `before_provider_request` Auto-Injection

Three primitives compose into one move:

1. **`graphify` skill** as the recall substrate. After every Operator subprocess finishes and after every `vibehack_confirm`, the `tool_result` hook shells out: `graphify update ~/.pi/agent/vibehack/engagements/<id>/`. Cross-engagement: a global graph at `~/.pi/agent/vibehack/graph/` aggregates every engagement's findings. AST-based, no API cost.
2. **`vibehack_recall <query>` tool** registered to the Planner only. Returns a structured subgraph: relevant entities (hosts/services/CVEs/credentials/findings/lessons/tools) + typed edges (served-by, exploited-via, derived-from, similar-to, contradicts, auth-for, valid-on).
3. **`before_provider_request` interception.** Before every Planner LLM call, the hook reads the current open hypothesis (events.jsonl tail), runs an embedding-similarity query against the global graphify graph, picks top-3 most-relevant subgraphs, and silently injects them into the system prompt as a `<recall>` block. Planner gets grounded context every turn without ever calling `vibehack_recall` itself.

**Why 10×:** Fenrir's wiki must be `read`; pi-vibehack injects it pre-flight. Every confirmed finding compounds across engagements. Replay-deterministic. Implementable in ~150 LoC with three documented pi primitives + the graphify skill the operator already has.

### 2.5 Five-Extension Composition

**Hard dependencies:**

- **`pi-prompt-template-model`** — replaces our hand-rolled router provider. Every slash command ships as a frontmatter template with `model` / `thinking` / `skill` / `restore: true`. Clean per-command dispatch with auto-restore.
- **`pi-dcp`** — Dynamic Context Pruning. Four vibehack-specific rules on the `context` event keep Planner working set under 20k tokens regardless of engagement length:
  - `prune-stale-tool-results` — older than current node's grandparent
  - `prune-folded-evidence` — already captured as node evidence
  - `prune-stale-recall` — superseded by current turn's `before_provider_request` injection
  - `prune-dead-branches` — pruned-branch artifacts dropped on status flip

**Soft companions (auto-detected):**

- **`memory-mode`** rewired as `/vibehack-pin <fact>` — engagement-scoped or global AGENTS.md curation, loaded at session_start.
- **`handoff`** rewired as auto-handoff at subprocess boundaries — `tool_result` hook generates handoff prompts for the next subprocess automatically.
- **`agent-guidance`** rewired as provider-specific personas — ships `prompts/personas/CLAUDE.md`, `CODEX.md`, `GEMINI.md`, `LOCAL.md`. Planner's `before_agent_start` reads pi's active provider and prepends the matching persona.
- **`pi-super-curl`** as the canonical HTTP/auth execution surface (§2.6).
- **`surf-cli`** + **`pi-annotate`** for browser automation (§6.1).

### 2.6 pi-super-curl integration

1. Auto-detect at `session_start`. Banner suggests install if absent.
2. Recipe skill swap: `super-curl.md` loads when scurl detected; `curl.md` otherwise.
3. Auth state as graph entities (`AuthProfile`, `Endpoint`, `Token`) with edges to nodes.
4. `/scurl-history` mirrored into events.jsonl as `evidence_add` with `kind: "http_replay"`.
5. **`sendToAgent` for live human-in-the-loop auth.** When Operator returns `outcome: "blocked-on-auth"` with a `scurl_template_request`, Planner fires `/scurl <template>`; user pastes the value; flows back; Operator subprocess respawned with the new auth profile. No public harness handles this without breaking flow.
6. Three vibehack scurl templates ship: `auth-bearer-probe`, `jwt-tamper`, `csrf-replay`.

### 2.7 Six-layer memory model

| Layer | Mechanism | Lifetime |
|---|---|---|
| Working context (lean) | `pi-dcp` rules | Per turn |
| Auto-injected grounding | `before_provider_request` + graphify | Per turn |
| Hand-curated facts | `memory-mode` AGENTS.md pin | Per engagement / global |
| Subprocess transition | `handoff` auto-generated prompt | Per subprocess hop |
| Replayable truth | `events.jsonl` | Forever |
| Cross-engagement knowledge | graphify global graph + `lessons.jsonl` | Forever |

Plus dispatch layers: `pi-prompt-template-model` per-command frontmatter, `agent-guidance` per-provider personas.

---

## 3. Roles & Subprocess Contracts

Three roles. Two run as spawned `pi --mode json -p --no-session` subprocesses for context isolation. One stays in the main session.

### 3.0 Default model mapping per profile

| Profile | Planner | Operator | Reporter |
|---|---|---|---|
| `hybrid` (default) | `claude-haiku-4-5` | `claude-opus-4-7` | `claude-opus-4-7` |
| `frontier` | `claude-sonnet-4-6` | `claude-opus-4-7` | `claude-opus-4-7` |
| `local` | `qwen-72b-instruct` (LM Studio / vLLM) | `qwen-72b-instruct` | `qwen-72b-instruct` |

Per-role overrides via `--planner` / `--operator` / `--reporter` flags persist to `~/.pi/agent/vibehack/.profile`. Frontmatter `model:` chains include sensible fallbacks per pi's MODELS registry.

### 3.1 Planner (main session)

- **Lives in:** the operator's pi window. Owns the hypothesis tree.
- **Model:** per profile mapping above (`hybrid` default → Haiku 4.5).
- **System prompt:** `prompts/personas/<provider>.md` + `prompts/planner-system.md` (loaded by `before_agent_start`).
- **Active tools:** `pi.setActiveTools(['read', 'grep', 'vibehack_expand', 'vibehack_prune', 'vibehack_confirm', 'vibehack_evidence', 'vibehack_recall', 'vibehack_dead_end', 'vibehack_propose_chain', 'vibehack_propose_specialist'])`. **No bash, no write, no edit.**
- **Output discipline:** hypothesis-or-die invariant.
- **Wire-layer grounding:** `before_provider_request` auto-injection.
- **Cannot see:** Operator/Reporter raw transcripts. Only structured returns.

### 3.2 Operator (spawned subprocess)

- **Spawned via:** `pi --mode json -p --no-session --append-system-prompt <tmp-operator-system.md> --model <profile-resolved>`.
- **Model:** per profile mapping in §3.0 (`hybrid` default → Opus 4.7).
- **Inherits:** **nothing from Planner transcript.** Receives typed input contract:

```json
{
  "engagement_id": "...",
  "node_id": "n_3a",
  "phase": "exploit",
  "claim": "JBoss 6.1 admin-console exposed at /jmx-console",
  "next_test": "POST a deserialization payload via JMXInvokerServlet",
  "falsifier": "non-200 response or missing JMXInvokerServlet endpoint",
  "requires_browser": false,
  "recipe_hints": ["super-curl.md", "searchsploit.md"],
  "specialist_skill": "web-exploit",
  "auth_profiles": [],
  "scope_notes": "...",
  "previous_handoff": "..."
}
```

- **Active tools:** `bash`, `read`, `write`, `edit`, `grep` + recipe skills + (when `requires_browser: true`) browser tools (surf-cli / pi-annotate / playwright-cli).
- **Output discipline:** structured JSON via `terminate: true`:

```json
{
  "node_id": "n_3a",
  "outcome": "confirmed | falsified | inconclusive | blocked-on-auth",
  "evidence": [{ "kind": "...", "ref": "...", "summary": "..." }],
  "confidence": 0.92,
  "suggested_next_steps": [{ "claim": "...", "next_test": "...", "falsifier": "..." }],
  "handoff_summary": "...",
  "auth_state_changes": {},
  "scurl_template_request": null,
  "cost_tokens": 14823,
  "cost_usd": 0.31
}
```

- **On `outcome: "blocked-on-auth"`:** returns `scurl_template_request`; Planner fires `/scurl <template>`; user fills field; `sendToAgent` flows back; subprocess respawned with new auth.
- **Aborts on:** depth-bound exceeded, time-bound exceeded, explicit `vibehack_dead_end`, operator `Ctrl+C`.

### 3.3 Reporter (spawned subprocess)

Two trigger modes:

- **Per-leaf** (on `vibehack_confirm`): drafts `engagements/<id>/poc/<node_id>/poc.md` with replayable artifact.
- **Final** (on `/vibehack-complete`): reads `events.jsonl` + `tree.md` + all per-leaf writeups + `AGENTS.md`. Writes `report.md` (exec summary, findings table, full PoCs, reproduction steps, remediation, IoC table).

- **Model:** per profile mapping in §3.0 (xhigh thinking on `frontier`; high on `hybrid`).
- **Inherits:** nothing from Planner/Operator transcripts. Reads only artifacts.
- **Tools:** `read`, `write`. Cannot execute. Cannot mutate the tree.

### 3.4 Subprocess isolation rationale

Target output (HTTP responses, file contents, captured shell output) is untrusted text. Spawning Operator/Reporter as `--no-session` subprocesses prevents prompt-injection from a malicious target page from reaching the Planner's transcript or persistent reasoning chain. The structured-JSON contract is the only channel — schema-validated before any field touches the Planner.

### 3.5 Auto-handoff chain

```
Planner emits next_test for n_3a
  → Operator subprocess #1 spawned with input contract
  → Operator finishes: outcome="inconclusive", suggested_next_steps[0]
  → handoff hook generates input contract for next subprocess:
      previous_handoff: "Operator #1 found admin console at /jmx-console
                         but could not confirm RCE without valid creds.
                         Recommend testing default jboss/jboss creds first."
  → Operator subprocess #2 spawned with that handoff
  → Continues until depth bound, dead-end, or confirmation
```

---

## 4. File Layout, Package Structure, Install Flow

### 4.1 Repo layout

```
@m4xx101/pi-vibehack/
├── package.json
├── README.md
├── CHANGELOG.md
├── LICENSE
├── bin/
│   └── install.js
├── extensions/
│   └── pi-vibehack/
│       ├── index.ts
│       ├── tools/
│       │   ├── expand.ts
│       │   ├── prune.ts
│       │   ├── confirm.ts
│       │   ├── evidence.ts
│       │   ├── recall.ts
│       │   ├── dead-end.ts
│       │   ├── propose-chain.ts
│       │   └── propose-specialist.ts
│       ├── hooks/
│       │   ├── session-start.ts
│       │   ├── before-agent-start.ts
│       │   ├── tool-call.ts
│       │   ├── tool-result.ts
│       │   ├── before-provider-request.ts
│       │   └── session-before-compact.ts
│       ├── dcp-rules/
│       │   ├── prune-stale-tool-results.ts
│       │   ├── prune-folded-evidence.ts
│       │   ├── prune-stale-recall.ts
│       │   └── prune-dead-branches.ts
│       ├── ui/
│       │   ├── status-banner.ts
│       │   └── tree-viewer.ts
│       ├── render/
│       │   └── tree-md.ts
│       ├── graph/
│       │   └── recall.ts
│       └── lib/
│           ├── events.ts
│           ├── handoff.ts
│           ├── operator-spawn.ts
│           ├── reporter-spawn.ts
│           ├── chain-runner.ts
│           ├── tool-ingest.ts
│           ├── specialist-ingest.ts
│           ├── negative-space.ts
│           └── persona.ts
├── prompts/
│   ├── vibehack.md
│   ├── vibehack-pause.md
│   ├── vibehack-resume.md
│   ├── vibehack-complete.md
│   ├── expand.md
│   ├── prune.md
│   ├── confirm.md
│   ├── steer.md
│   ├── vibehack-ingest.md
│   ├── vibehack-distill.md
│   ├── vibehack-tree.md
│   ├── vibehack-cost.md
│   ├── vibehack-update.md
│   ├── vibehack-pin.md
│   ├── vibehack-handoff.md
│   ├── vibehack-chain-confirm.md
│   ├── vibehack-chain-reject.md
│   └── personas/
│       ├── CLAUDE.md
│       ├── CODEX.md
│       ├── GEMINI.md
│       └── LOCAL.md
├── skills/
│   ├── planner-recipes/SKILL.md
│   ├── operator-recipes/SKILL.md
│   ├── reporter-recipes/SKILL.md
│   ├── distill-recipes/SKILL.md
│   ├── ingest-recipes/SKILL.md
│   ├── recipes/
│   │   ├── curl/SKILL.md
│   │   ├── super-curl/SKILL.md
│   │   ├── httpx/SKILL.md
│   │   ├── nuclei/SKILL.md
│   │   ├── ffuf/SKILL.md
│   │   ├── searchsploit/SKILL.md
│   │   ├── nmap/SKILL.md
│   │   ├── surf-cli/SKILL.md
│   │   └── playwright-cli/SKILL.md
│   ├── specialists/
│   │   ├── web-recon/SKILL.md
│   │   ├── web-exploit/SKILL.md
│   │   ├── binary-recon/SKILL.md
│   │   ├── auth-bypass/SKILL.md
│   │   └── osint/SKILL.md
│   └── lessons/                    # auto-grown by /vibehack-distill
├── subagents/
│   ├── vibehack-operator.md
│   └── vibehack-reporter.md
├── templates/
│   └── scurl/
│       ├── auth-bearer-probe.json
│       ├── jwt-tamper.json
│       └── csrf-replay.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── INSTALL.md
│   ├── OPERATOR-GUIDE.md
│   └── adr/
│       ├── 0001-event-sourced-jsonl.md
│       ├── 0002-graphify-as-recall-substrate.md
│       ├── 0003-before-provider-request-injection.md
│       ├── 0004-prompt-template-model-as-dispatch.md
│       ├── 0005-pi-dcp-as-context-budget.md
│       ├── 0006-subprocess-isolation-for-untrusted-output.md
│       ├── 0007-unleashed-scope.md
│       ├── 0008-vendoring-fallback-for-hard-deps.md
│       └── 0009-specialists-as-skills-not-subagents.md
└── tests/
    ├── install.test.js
    ├── events-schema.test.js
    ├── tree-render.test.js
    ├── recall-injection.test.js
    ├── dcp-rules.test.js
    ├── handoff.test.js
    ├── negative-space.test.js
    ├── chain-mode.test.js
    ├── tool-ingest.test.js
    └── recipes.test.js
```

### 4.2 `package.json` core

```json
{
  "name": "@m4xx101/pi-vibehack",
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=18" },
  "bin": { "pi-vibehack": "bin/install.js" },
  "main": "bin/install.js",
  "files": ["bin/", "extensions/", "prompts/", "skills/", "subagents/", "templates/", "docs/", "README.md", "LICENSE", "CHANGELOG.md"],
  "pi": {
    "extensions": ["./extensions/pi-vibehack/index.ts"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  },
  "peerDependencies": {
    "@nicobailon/pi-prompt-template-model": "^1.0.0",
    "pi-dcp": "^1.0.0"
  },
  "optionalDependencies": {
    "pi-super-curl": "*",
    "@hjanuschka/memory-mode": "*",
    "@hjanuschka/handoff": "*",
    "@tmustier/agent-guidance": "*",
    "surf-cli": "*",
    "@nicobailon/pi-annotate": "*"
  }
}
```

(Final org/scope names verified at publish time.)

### 4.3 Runtime data layout

```
~/.pi/agent/
├── settings.json                   # one-line edit on install
└── vibehack/
    ├── AGENTS.md                   # global pinned facts
    ├── lessons.jsonl               # cross-session distilled lessons
    ├── graph/                      # global graphify graph
    ├── tools/                      # ingested + on-the-fly tools
    │   ├── <repo-slug>/
    │   ├── <generated-tool>/
    │   │   ├── bin/<tool>
    │   │   └── README.md
    │   └── PATH-shim.sh
    ├── specialists/learned/        # operator-grown specialists
    └── engagements/
        └── <YYYY-MM-DD-target-slug>/
            ├── events.jsonl        # source of truth, append-only
            ├── tree.md             # rendered projection
            ├── findings.md
            ├── AGENTS.md           # engagement-pinned facts
            ├── report.md           # written at /vibehack-complete
            ├── poc/<node_id>/
            │   ├── poc.md
            │   ├── replay.curl
            │   ├── replay.scurl.json
            │   └── browser.jsonl   # if browser-touched
            ├── audit.log
            └── graph/
```

### 4.4 Install flow

`npx -y @m4xx101/pi-vibehack install [--profile {hybrid|local|frontier}] [--planner X] [--operator Y] [--reporter Z] [--local]`:

1. Verify pi-mono installed (`pi --version`). Print install hint if not.
2. Read `~/.pi/agent/settings.json` (create if missing).
3. Add `"npm:@m4xx101/pi-vibehack@<pinned-version>"` to `packages` array (idempotent).
4. Add hard-dep entries for `pi-prompt-template-model` and `pi-dcp` (idempotent).
5. Detect optional deps; print one-line "💡 install X for Y power-ups" hints (no auto-install).
6. Create `~/.pi/agent/vibehack/` skeleton (`lessons.jsonl`, `AGENTS.md`, `graph/`, `tools/`, `specialists/learned/`).
7. `--profile` rewrites `model:` frontmatter chain across `prompts/` files at install-time.
8. `--planner` / `--operator` / `--reporter` overrides per-role and persists to `~/.pi/agent/vibehack/.profile`.
9. `--local` writes to `.pi/settings.json` (project-scoped) instead of global.
10. Print: `✓ pi-vibehack installed. Restart pi or /reload. Run /vibehack <target> to start.`

**Uninstall** (`npx @m4xx101/pi-vibehack uninstall`): removes settings.json line. Leaves engagement data untouched.

**Update** (`/vibehack-update`): bumps pinned version, prints changelog diff, suggests `/reload`.

---

## 5. End-to-End Engagement Walkthrough

Concrete: bug bounty target `acme.example`, `--profile hybrid`.

| T+ | Event |
|---|---|
| 0 | `npx -y @m4xx101/pi-vibehack install --profile hybrid` → settings.json updated, `~/.pi/agent/vibehack/` created. `pi` boots with banner `🌳 pi-vibehack ready · no engagement`. |
| 1 | `/vibehack acme.example` → engagement dir created, root + 4 surfaces (web/subdomains/API/email). `tree.md` rendered. |
| 2 | Planner picks subdomain-enum leaf, spawns Operator subprocess (Haiku for recon). Operator runs subfinder + httpx, returns confirmed evidence. `tool_result` hook synthesizes negative-space findings (missing HSTS on 31/47 subdomains). `graphify update` runs. |
| 3 | `before_provider_request` injects `<recall>` block surfacing prior engagement's JBoss 6.1 → CVE-2017-12149 chain + global lesson "JBoss default creds: jboss/jboss tested first; 12% hit rate." Planner reasons with grounding **without ever calling `vibehack_recall`**. |
| 4 | Operator subprocess #2 (Opus, frontier) confirms `old-jboss.acme.example` runs JBoss 6.1, default creds work. Auth profile mirrored into pi-super-curl's config; AuthProfile entity added to graph. |
| 5 | `/confirm n_3b` → Per-leaf Reporter drafts `poc/n_3b/poc.md` with replayable scurl JSON + curl one-liner. Planner expands deeper; Operator runs deserialization payload, gets shell. |
| 6 | By turn 12, working context would balloon to 47k. DCP rules prune to 12k. Planner stays sharp. |
| 7 | `/steer focus on jenkins` → Planner reprioritizes mid-flight, prunes one jboss-deeper branch, expands jenkins surface. |
| 8 | Operator on jenkins hits CSRF-token wall. Returns `outcome: "blocked-on-auth"` with `scurl_template_request: csrf-replay`. Planner fires `/scurl csrf-replay`. User pastes captured token; `sendToAgent` flows back. Operator respawned with new auth. |
| 9 | Auto-compaction at ~150k JSONL entries. `session_before_compact` extracts `(situation, action, outcome)` triples → appends to `lessons.jsonl`. Custom summary returned. |
| 10 | `/vibehack-distill` → reads last 3 engagements, synthesizes refined `skills/learned/jboss-jmx-rce.md`. Hot-reload. |
| 11 | `/vibehack-complete` → final Reporter (Opus, xhigh thinking) writes `report.md` with exec summary, 3 findings, full PoCs, remediation, IoCs. |
| 12 | Weeks later, `/vibehack new-target.example` — first turn's `<recall>` already hits cross-engagement patterns. Every engagement starts smarter than the last. |

---

## 6. Goals, Non-Goals, Risks, Acceptance Criteria

### 6.1 Goals (in v1.0)

**Goal 1 — Browser automation, top-notch.** Compose `surf-cli` (nicobailon, Pinned) + `pi-annotate` (nicobailon) as soft companions. Fallback: Playwright CLI (`npx playwright`) via bash recipe. Recipe skills: `surf-cli/SKILL.md`, `playwright-cli/SKILL.md`. Operator subprocess gets browser tools when leaf's `requires_browser: true`. Browser-touched leaves recorded in `poc/<node_id>/browser.jsonl`.

**Goal 4 — Tool-extension on the fly (the *real* matrix-glitch).** `/vibehack-ingest` supports four input modes:

1. **Existing CLI on PATH** — runs `--help`, drafts a recipe SKILL.md.
2. **Public git repo** — clones to `~/.pi/agent/vibehack/tools/<repo-slug>/`, reads README + `--help`, drafts recipe + install/build steps.
3. **Tool name + description** — Operator subprocess (frontier, xhigh thinking) searches, proposes, writes, tests, ships a Python or Go tool from scratch into `tools/<name>/`. **Validation target:** the operator supplies a `--validate-against <url|file>` (e.g., a localhost echo server, a known-good API endpoint, a sample input file); the ingest run gates landing on the tool producing a non-empty, sanity-checked output against that target. If `--validate-against` is omitted, validation defaults to running the tool with `--help` and checking exit code 0. Failed validation rolls back the `tools/<name>/` directory.
4. **Inline spec** — same as #3 but operator-authored brief.

PATH shim (`tools/PATH-shim.sh`) prepends `vibehack/tools/*/bin` for spawned subprocesses only. New `vibehack_tool` event type lands in events.jsonl; graphify indexes it; cross-engagement `<recall>` surfaces "you wrote a wayback-paginate tool 2 weeks ago." Bundled nine recipe files (eight active at any time — `curl` ↔ `super-curl` swap based on detection) are seeds, not a ceiling. Every operator's vibehack instance grows differently.

**Goal 6 — Auto-exploit chaining with operator confirmation.** `vibehack_propose_chain(root_node_id, steps[])` creates a typed subtree (root = entry vuln, children = sequential post-ex steps). Status banner: `🌳 ... · ⚠ chain proposed: n_3b → n_4a → n_5c — /vibehack-chain-confirm or /vibehack-chain-reject`. `--interactive` runs step-by-step requiring `Enter`. Read-only chains can auto-confirm via `/vibehack-config auto-chain-readonly true`. Default: every chain confirmed.

**Goal 9 — Specialists-as-skills, infinitely extensible.** Five specialists ship at v1.0 (`web-recon`, `web-exploit`, `binary-recon`, `auth-bypass`, `osint`) — each a single SKILL.md. `vibehack_propose_specialist(node_id, kind)` checks `skills/specialists/<kind>/SKILL.md` (shipped) or `~/.pi/agent/vibehack/specialists/learned/<kind>/SKILL.md` (operator-grown). Operator subprocess spawns same as ever, just with sharper system prompt + recipe-skill subset. `/vibehack-ingest --specialist <kind>` drafts new ones. The fenrir trap (16 specialist subagents) inverted: same flexibility, ~zero structural complexity.

### 6.2 Non-goals (deliberately out of v1.0)

1. Bespoke RAG over CVE/exploit-db. searchsploit + nuclei templates suffice.
2. Multi-target orchestration. One target per engagement; OS is the scheduler.
3. Cost dashboards / fancy TUI. Status banner + `/vibehack-cost` + `audit.log` greppable.
4. Custom DSL for playbooks. Frontmatter templates + recipe skills + tree replace any DSL.
5. MCP server bundling. v1.1 — pi-mcp-adapter handles it.
6. Self-hosting graphify. Soft-degrades to grep-over-events.jsonl when absent.
7. GUI / web UI. TUI only. `tree.md` covers external-tool workflows.
8. Distributed engagements / team mode. Single-operator. Multi-operator = git-share `engagements/<id>/`.

### 6.3 Slash command surface (15 core + 2 soft-companion = 17 prompt files)

**Engagement lifecycle (4):** `/vibehack <target>`, `/vibehack-pause`, `/vibehack-resume [id]`, `/vibehack-complete`.

**Tree verbs (4):** `/expand <node>`, `/prune <node> [reason]`, `/confirm <leaf>`, `/steer <text>`.

**Knowledge / tooling (3):** `/vibehack-ingest <url|tool|repo|description> [--validate-against <target>] [--specialist <kind>]`, `/vibehack-distill [--specialists]`, `/vibehack-tree`.

**Chain control (2):** `/vibehack-chain-confirm [--interactive]`, `/vibehack-chain-reject [reason]`.

**Meta (2):** `/vibehack-cost`, `/vibehack-update`.

**Soft-companion (2, only functional if soft deps installed):** `/vibehack-pin <fact> [--global]`, `/vibehack-handoff [engagement-id]`.

### 6.4 Risks & mitigations

| Risk | Mitigation |
|---|---|
| Prompt injection from target output poisons Planner | Subprocess isolation; structured-JSON-only return contract; schema validation before reaching Planner. |
| `before_provider_request` injection too much / too little | DCP rule `prune-stale-recall` keeps only current turn. Recall query budget capped at 3 subgraphs / 2k tokens. |
| graphify slow/fails/absent | Soft-degrade to grep-over-events.jsonl. Recall fallback banner. |
| Hypothesis-or-die false-positives | `vibehack_dead_end` clean exit. `vibehack_evidence` (read-only) counts as mutation. |
| Operator subprocess hangs / runs cost away | Subprocess time-bound + token-bound flags. Tree-viewer abort key. |
| events.jsonl unbounded growth | In-memory fold cache with append-invalidation. v1.0 target: 10k events feels instant. |
| Hard deps unmaintained | Both ~500 LoC each; vendor-fork procedure documented in ADR-0008. |
| scurl version drift breaks `sendToAgent` | Version-detect at session_start; warn if below known-good. |
| Unleashed scope = unauthorized targets | Operator's responsibility per README/INSTALL/first-run banner. audit.log for forensics. |
| Frontmatter dispatch picks wrong model on local profile | One-line sed across `prompts/` at reinstall. Per-role override flags. `.profile` for reproducibility. |
| Negative-space synthesis spam | Only documented absences (5 HTTP headers + nmap baseline + DNS records). `synthetic: true` tag. |
| DCP over-pruning | Each rule unit-tested; `keep-last-N-turns` floor; `/vibehack-tree` shows JSONL truth. |
| Hot-reload mid-engagement breaks | Skills read-only at session boundaries; `/vibehack-distill` prompts `/reload`. No silent reloads. |
| On-the-fly tool generation produces broken tools | Mode-3/4 ingest validates against known-safe target before landing. Failed validation rolls back. Audit-logged. |
| PATH shim conflicts with operator's existing tools | Shim prepends only for spawned subprocesses, not interactive shell. `--prefix` flag for opt-in `vibehack-` namespacing. |
| Specialist SKILL.md drift / quality decay | Shipped specialists versioned with vibehack; learned ones at operator's discretion. `/vibehack-distill --specialists` refines from successful patterns. |
| Chain mode runs cost away | Per-chain advisory cost cap (banner-warned, never-blocked under unleashed scope). Tree-viewer abort. |
| Browser breaks deterministic replay | Browser-touched leaves marked `replay: best-effort`. PoC includes both action sequence and curl approximation when feasible. |

### 6.5 v1.0 acceptance criteria

**Install / lifecycle:**

- [ ] `npx -y @m4xx101/pi-vibehack install` is idempotent.
- [ ] Uninstall removes settings.json line, leaves engagement data.
- [ ] Installer detects missing pi-mono with clear hint.
- [ ] Hard deps auto-add to settings.json.
- [ ] Soft deps detected at runtime; banner messaging works.
- [ ] `--profile {hybrid|local|frontier}` rewrites prompt frontmatter; reinstall reproduces.
- [ ] `--planner` / `--operator` / `--reporter` per-role overrides persist via `.profile`.

**Tree + invariants:**

- [ ] `/vibehack <target>` creates engagement, root, top-level surfaces.
- [ ] Hypothesis-or-die rejects no-op turns; `vibehack_dead_end` is clean escape.
- [ ] Falsifier required on `vibehack_expand`.
- [ ] Depth ≤ 6, breadth ≤ 8 enforced.
- [ ] Negative-space synthesis fires on documented absences.
- [ ] tree.md re-renders deterministically from events.jsonl.
- [ ] events.jsonl schema validates; replay reproduces tree.md byte-for-byte.

**Subprocess isolation:**

- [ ] Operator/Reporter spawned with `--mode json -p --no-session`.
- [ ] Structured-JSON return schema-validated before Planner sees fields.
- [ ] No Planner transcript leaks into subprocesses.
- [ ] Auto-handoff prompt at every subprocess boundary.

**Recall layer:**

- [ ] `vibehack_recall` returns subgraphs from local + global graphify graph.
- [ ] `before_provider_request` auto-injects top-3 subgraphs into Planner system prompt.
- [ ] `prune-stale-recall` removes superseded `<recall>` blocks.
- [ ] Soft-degrades to grep when graphify absent.

**DCP layer:**

- [ ] All 4 rules registered and unit-tested.
- [ ] Working context stays under 20k tokens at 50-turn engagement (target ~12k).

**Slash commands:**

- [ ] All 15 commands work; frontmatter pins correct model/thinking/skill.
- [ ] `/steer` injects mid-flight without breaking the tree.
- [ ] `/scurl` integration handles `blocked-on-auth` flow end-to-end (when scurl present).
- [ ] `/vibehack-distill` writes valid SKILL.md to `skills/learned/`; hot-reload after `/reload`.

**Browser automation (Goal 1):**

- [ ] surf-cli detected → recipe loaded; falls back to playwright-cli; falls back to curl.
- [ ] Recorded action sequences land in `poc/<node_id>/browser.jsonl`.

**Tool ingest (Goal 4):**

- [ ] All 4 modes work (CLI, repo, name+description, inline).
- [ ] Generated tools validate against known-safe target before landing.
- [ ] PATH shim prepends correctly for Operator subprocess only.

**Chain mode (Goal 6):**

- [ ] `/vibehack-chain-confirm` runs chain mode; `--interactive` halts between steps.
- [ ] Chain step rejection prunes proposal cleanly.

**Specialists (Goal 9):**

- [ ] 5 shipped specialist skills load via `vibehack_propose_specialist`.
- [ ] `/vibehack-ingest --specialist <kind>` drafts SKILL.md, validates via dry-run Operator, lands in `specialists/learned/`.

**Reporter:**

- [ ] Per-leaf reporter writes `poc/<node_id>/poc.md` with replay artifact.
- [ ] Final reporter writes `report.md` with full structure.

**Cross-engagement memory:**

- [ ] `lessons.jsonl` appends at compaction; loads at session_start.
- [ ] Global graphify graph updated on every confirmed leaf.
- [ ] Second engagement against similar target shows recall hits.

**Tests:**

- [ ] `install`, `events-schema`, `tree-render`, `recall-injection`, `dcp-rules`, `handoff`, `negative-space`, `chain-mode`, `tool-ingest`, `recipes` test files all pass.
- [ ] One end-to-end smoke test against DVWA-in-Docker confirms §5 walkthrough.

**Docs:**

- [ ] README, INSTALL.md, ARCHITECTURE.md, OPERATOR-GUIDE.md, 9 ADRs, CHANGELOG.md, LICENSE present.
- [ ] "Authorized testing only" disclaimer prominent in README and first-run banner.

---

## 7. Component Count Summary

- 1 extension (`extensions/pi-vibehack/index.ts`)
- 6 lifecycle hooks
- 4 vibehack DCP rules
- 8 custom Planner tools
- 15 frontmatter slash commands
- 4 provider personas
- 9 recipe skill files, 8 active at any time (`curl` ↔ `super-curl` swap based on scurl detection): curl, super-curl, httpx, nuclei, ffuf, searchsploit, nmap, surf-cli, playwright-cli
- 5 specialist skills (web-recon, web-exploit, binary-recon, auth-bypass, osint)
- 3 scurl templates
- 2 subagent role files
- 1 fullscreen TUI viewer + 1 status banner
- 9 ADRs
- 10 test files
- 2 hard deps (`pi-prompt-template-model`, `pi-dcp`)
- 5 soft deps (`pi-super-curl`, `memory-mode`, `handoff`, `agent-guidance`, `surf-cli` — `pi-annotate` is a sub-companion of surf-cli)

---

## 8. Sources

- [badlogic/pi-mono](https://github.com/badlogic/pi-mono) — runtime (extensions doc, examples)
- [nicobailon GitHub profile](https://github.com/nicobailon) — extension catalog reference
- [nicobailon/pi-prompt-template-model](https://github.com/nicobailon/pi-prompt-template-model) — hard dep
- [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents) — subagent pattern reference
- [nicobailon/pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) — lazy-discovery pattern
- [nicobailon/surf-cli](https://github.com/nicobailon/surf-cli) — browser automation companion
- [zenobi-us/pi-dcp](https://github.com/zenobi-us/pi-dcp) — hard dep, context budget
- [Graffioh/pi-super-curl](https://github.com/Graffioh/pi-super-curl) — HTTP/auth surface
- [hjanuschka/shitty-extensions](https://github.com/hjanuschka/shitty-extensions) — `memory-mode`, `handoff`
- [tmustier/pi-extensions/agent-guidance](https://github.com/tmustier/pi-extensions/tree/main/agent-guidance) — provider-persona pattern
- [qualisero/awesome-pi-agent](https://github.com/qualisero/awesome-pi-agent) — extension index

SOTA references (cutoff Jan 2026, verify before publishing): Project Naptime / Big Sleep, PentestGPT (USENIX 2024), HackingBuddyGPT, CAI, Cybench, EnIGMA / SWE-agent, NYU CTF Bench, XBOW.

---

## 9. Status & Next Step

This spec is locked. Next: implementation plan via the `superpowers:writing-plans` skill, decomposing this design into atomic, testable phases.
