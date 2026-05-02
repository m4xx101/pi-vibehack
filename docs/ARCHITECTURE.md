# pi-vibehack — Architecture

Full architectural reference. Canonical locked design: [`superpowers/specs/2026-04-29-pi-vibehack-design.md`](superpowers/specs/2026-04-29-pi-vibehack-design.md). Executable plan: [`superpowers/plans/2026-04-29-pi-vibehack.md`](superpowers/plans/2026-04-29-pi-vibehack.md).

## 30,000-foot view

```
┌──────────────────────────────────────────────────────────────────────────┐
│  OPERATOR (you)                                                          │
│  • types slash commands, reads tree.md, accepts/rejects chains            │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PLANNER (in main pi session — read-only tools + 8 vibehack_*)           │
│  • before_agent_start hook injects: persona + system + AGENTS.md +       │
│    handoff + steer + invariant gate + bounds advisory + <recall>          │
│  • emits one mutation tool per turn (hypothesis-or-die invariant)        │
└──────────────────────────────────────────────────────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
   ┌────────────────┐   ┌──────────────────┐   ┌──────────────────┐
   │ LIFECYCLE HOOKS│   │  PLANNER TOOLS   │   │  pi-dcp RULES    │
   │ session_start  │   │  vibehack_expand │   │  prune-stale-    │
   │ before_agent_  │   │  vibehack_prune  │   │   recall         │
   │   start        │   │  vibehack_       │   │  prune-stale-    │
   │ tool_call      │   │   confirm        │   │   tool-results   │
   │ tool_result    │   │  vibehack_       │   │  prune-folded-   │
   │ before_        │   │   evidence       │   │   evidence       │
   │   provider_    │   │  vibehack_       │   │  prune-dead-     │
   │   request      │   │   dead_end       │   │   branches       │
   │ session_       │   │  vibehack_       │   └──────────────────┘
   │   before_      │   │   propose_chain  │
   │   compact      │   │  vibehack_       │
   └────────────────┘   │   propose_       │
                        │   specialist     │
                        │  vibehack_recall │
                        └──────────────────┘
                                  │
                                  ▼
   ┌────────────────────────────────────────────────────────────┐
   │  SUBPROCESS POOL                                            │
   │  ┌────────────────┐    ┌────────────────┐                   │
   │  │  OPERATOR      │    │  REPORTER      │                   │
   │  │  pi --no-      │    │  pi --no-      │                   │
   │  │   session      │    │   session      │                   │
   │  │  bash + recipe │    │  read + write  │                   │
   │  │  skills + opt  │    │  per-leaf or   │                   │
   │  │   browser      │    │   final        │                   │
   │  │  structured    │    │  no execution  │                   │
   │  │   JSON return  │    └────────────────┘                   │
   │  └────────────────┘                                         │
   └────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
   ┌────────────────────────────────────────────────────────────┐
   │  FILESYSTEM LAYER (~/.pi/agent/vibehack/)                   │
   │  AGENTS.md            ← global pinned facts                 │
   │  lessons.jsonl        ← cross-engagement triples             │
   │  tools/               ← ingested + synthesized tools         │
   │  specialists/learned/ ← operator-grown specialist skills     │
   │  graph/               ← global graphify graph                │
   │  engagements/<id>/                                           │
   │     events.jsonl      ← append-only source of truth          │
   │     tree.md           ← rendered projection                  │
   │     findings.md       ← rendered projection                  │
   │     AGENTS.md         ← engagement-pinned facts              │
   │     audit.log         ← every tool call (forensics)          │
   │     poc/<node_id>/    ← per-leaf reporter artifacts          │
   │     graph/            ← engagement-local graphify graph      │
   │     report.md         ← final report (after /complete)       │
   │     .pending-handoff  ← consumed by next before_agent_start  │
   │     .pending-steer    ← consumed by next before_agent_start  │
   └────────────────────────────────────────────────────────────┘
```

## The hypothesis tree (data model)

Every mutation is one JSONL line in `events.jsonl`. Sixteen event types:

| Event | When |
|---|---|
| `engagement_start` | `/vibehack <target>` fires |
| `engagement_end` | `/vibehack-complete` fires |
| `node_add` | `vibehack_expand` |
| `node_update` | `vibehack_dead_end`, status flips |
| `node_prune` | `vibehack_prune` |
| `evidence_add` | `vibehack_evidence` + negative-space synthesis |
| `confirm` | `vibehack_confirm` |
| `steer` | `/steer <text>` |
| `tool_call` | `tool_call` hook (every tool invocation) |
| `tool_result` | `tool_result` hook (every tool result, cost tally) |
| `lesson` | `session_before_compact` distillation |
| `vibehack_tool` | `/vibehack-ingest` lands a tool |
| `chain_propose` | `vibehack_propose_chain` |
| `chain_confirm` | `/vibehack-chain-confirm` |
| `chain_reject` | `/vibehack-chain-reject` |
| `specialist_propose` | `vibehack_propose_specialist` |

Schema enforcement: typebox validation on every `appendEvent`. Strict ISO 8601 with timezone designator on `ts`. `additionalProperties: false` on all objects. `cost_tokens` and `cost_usd` are non-negative.

### Folded views

`tree.md` and `findings.md` are **rendered** from events.jsonl on every mutation — never written as truth. `foldNodes()` walks events in order, mutates a `Map<node_id, Node>`. Children sorted by node_id for determinism. Cycle guard via `visited: Set` in `walk()`. Orphan events (e.g., `node_update` for a never-`node_add`'d node) emit `console.warn` and skip.

### Six loop invariants

1. **Hypothesis-or-die.** Every Planner turn must invoke one of the 5 mutating tools (`vibehack_expand`, `vibehack_prune`, `vibehack_confirm`, `vibehack_evidence`, `vibehack_dead_end`). Proposals do **not** satisfy the invariant — they stage operator-gated changes. Enforced by `getMutationGateMessage()` injecting an `<invariant>` block into next `before_agent_start`.
2. **Falsifier required.** `vibehack_expand` rejects non-root nodes with empty `falsifier`.
3. **Depth ≤ 6, breadth ≤ 8.** Advisory injected via `<bounds_advisory>` block as the tree approaches limits. Soft enforcement.
4. **Negative-space synthesis.** `tool_result` hook diffs HTTP responses against expected headers and nmap output against a common-ports baseline. Misses become synthesized `evidence_add` events tagged `synthetic: true`.
5. **Subprocess context isolation.** Operator and Reporter run as `pi --mode json -p --no-session` subprocesses. They never see Planner transcripts. Structured JSON is the only channel; schema-validated before any field reaches the Planner.
6. **Cost as metadata, never gate.** Every tool/LLM call writes a `cost_usd` event. Status banner totals it. Nothing blocks. Per [ADR-0007](adr/0007-unleashed-scope.md).

## The 10× move — graphify recall + `before_provider_request` injection

```
operator turn N completes
       ▼
[Planner emits mutation, e.g. vibehack_expand on n_3a]
       ▼
[tool_result hook]
   ├── append tool_result event
   ├── if confirm/evidence: triggerGraphifyUpdate(engagement_dir)
   └── if confirm/evidence: triggerGlobalGraphifyUpdate()
                            (~/.pi/agent/vibehack/graph/)
       ▼
operator turn N+1 begins
       ▼
[before_provider_request hook]
   ├── pickOpenHypothesisQuery(events) → "JBoss 6.1 admin-console exposed"
   ├── recall(query) → up to 3 subgraphs from local + global graphify
   ├── formatRecallBlock(subs) → "<recall>...</recall>"
   └── injects as system message at front of payload.messages
       ▼
[Planner LLM call]
   • sees <recall> block as part of system context
   • reasons with grounded prior knowledge from past engagements
   • emits next mutation
       ▼
[DCP rule prune-stale-recall] — drops the <recall> block from working
   context after this turn (next turn's injection supersedes it)
```

No public harness does this. Every engagement compounds the global graph; subsequent engagements against similar targets get telepathic context for free. Falls back gracefully to grep-over-events.jsonl when graphify is absent.

## Six-layer memory model

| Layer | Mechanism | Lifetime | Where |
|---|---|---|---|
| Working context (lean) | pi-dcp 4 rules | per turn | LLM context only |
| Auto-injected grounding | `before_provider_request` + graphify | per turn | system block, transient |
| Hand-curated facts | `/vibehack-pin` → AGENTS.md | per engagement / global | `<engagement>/AGENTS.md` or `~/.pi/agent/vibehack/AGENTS.md` |
| Subprocess transition | auto-handoff prompt | per subprocess hop | `.pending-handoff` file |
| Replayable truth | events.jsonl | forever | `<engagement>/events.jsonl` |
| Cross-engagement | global graph + lessons.jsonl | forever | `graph/`, `lessons.jsonl` |

## Three roles + subprocess contracts

### Planner (main session)

- Tools: `read`, `grep`, 8 `vibehack_*` tools (set via `pi.setActiveTools`).
- No `bash`, `write`, `edit` — read-only world.
- Cannot see Operator/Reporter transcripts.
- Must satisfy hypothesis-or-die or use `vibehack_dead_end`.

### Operator (spawned subprocess per leaf)

```
pi --mode json -p --no-session \
   --append-system-prompt /tmp/vh-op-XXX/system.md \
   --model <profile.operator>
```

Receives JSON input contract (engagement_id, node_id, claim, next_test, falsifier, recipe_hints, specialist_skill, auth_profiles, previous_handoff, scope_notes, requires_browser).

Returns structured JSON via `terminate: true`: outcome (confirmed/falsified/inconclusive/blocked-on-auth), evidence[], confidence, suggested_next_steps[], handoff_summary, auth_state_changes, scurl_template_request, cost.

### Reporter (per-leaf + final)

Per-leaf: auto-spawned by `tool_result` hook on `confirm` event. Drafts `poc/<node_id>/poc.md` with replay artifacts.

Final: spawned by `/vibehack-complete`. Reads everything (events.jsonl, tree.md, all `poc/<node_id>/poc.md`, AGENTS.md). Writes `report.md`. Tools: `read`, `write` only.

## Auto-handoff chain

```
Operator subprocess #1 returns: outcome=inconclusive, handoff_summary="..."
       ▼
[tool_result hook]
   buildHandoff(out) → "Previous Operator finished node n_3a with..."
   setPendingHandoff(eng, body) → writes <engagement>/.pending-handoff
       ▼
operator/planner turn N+1 begins
       ▼
[before_agent_start hook]
   consumePendingHandoff(eng) → reads + deletes the file
   injects <handoff_from_prior_subprocess>...</...>
       ▼
[Planner sees the handoff context]
   reasons about whether to spawn another Operator (chain)
   or pivot via vibehack_prune + vibehack_expand on a sibling
```

## Five-extension composition

| Extension | Role | Hard or soft? |
|---|---|---|
| `pi-prompt-template-model` | per-command model + thinking + skill dispatch via frontmatter | **Hard** |
| `pi-dcp` | Dynamic Context Pruning rules | **Hard** |
| `pi-super-curl` | HTTP/auth surface, scurl templates, `sendToAgent` round-trip | Soft |
| `surf-cli` | Chrome control for `requires_browser` leaves | Soft |
| `memory-mode` / `handoff` / `agent-guidance` | inspirations folded into our hooks | (companions) |

Soft deps: pi-vibehack auto-detects at `session_start` and emits `💡 install X` banner. Recipes swap (`curl` ↔ `super-curl`, `surf-cli` ↔ `playwright-cli`).

## DCP rules

Four rules registered with pi-dcp via `globalThis.__vibehack_dcp_rules`:

1. **`prune-stale-recall`** — keeps only most recent `<recall>` block in working context.
2. **`prune-stale-tool-results`** — drops tool_result entries older than `KEEP_LAST_N_TURNS=4` turns.
3. **`prune-folded-evidence`** — when evidence is folded into the tree, the underlying tool call's `toolCallId` is added to `globalThis.__vibehack_folded_call_ids`; the rule prunes the working-context message.
4. **`prune-dead-branches`** — `vibehack_dead_end`/`vibehack_prune` adds the node_id to `globalThis.__vibehack_dead_node_ids`; rule prunes any message tagged with that node_id.

## Negative-space synthesis

Triggered in `tool_result` hook when `event.toolName === "bash"` and `typeof event.output === "string"`.

| Signal | Detector | Severity |
|---|---|---|
| HTTP response missing CSP | `detectMissingHeaders` | medium |
| HTTP response missing HSTS | `detectMissingHeaders` | medium |
| HTTP response missing X-Frame-Options | `detectMissingHeaders` | low |
| HTTP response missing Permissions-Policy | `detectMissingHeaders` | low |
| HTTP response missing Referrer-Policy | `detectMissingHeaders` | low |
| Set-Cookie missing SameSite | `detectMissingHeaders` | low |
| Common port not in nmap open set | `detectFilteredPorts` (top 3) | info |
| Missing SPF in DNS TXT | `detectMissingDns` | medium |
| Missing DMARC in DNS TXT | `detectMissingDns` | medium |
| Missing DKIM at apex | `detectMissingDns` | low |

All synthesized events are tagged `synthetic: true` and rendered with `⚪` glyph in tree.md.

## Tool-ingest pipeline

`/vibehack-ingest <target> [--specialist <kind>] [--validate-against <url-or-file>] [--inline]` dispatches:

| Mode | Trigger | Behavior |
|---|---|---|
| `cli` | target on PATH | Captures `--help`, drafts `skills/learned/<slug>/SKILL.md` |
| `repo` | target = git URL | Clones to `tools/<slug>/`, drafts recipe + writes PATH shim |
| `synthesis` | name + description | Operator subprocess writes a Python or Go tool from scratch into `tools/<slug>/`. Validation gate via `--validate-against <target>`. Failed validation → rollback. |
| `inline` | `--inline` flag | Same as synthesis but operator-authored brief |
| `--specialist` | `--specialist <kind>` flag | Routes to `landSpecialist()` writing `specialists/learned/<kind>/SKILL.md` |

PATH shim (`~/.pi/agent/vibehack/tools/PATH-shim.sh`) regenerated on every successful ingest. Operator subprocess inherits via `envWithShim()`.

## Specialists-as-skills runtime

`vibehack_propose_specialist(node_id, kind)` writes a `specialist_propose` event. When the next Operator subprocess spawns for that node, `loadSpecialist(kind)` checks:

1. `skills/specialists/<kind>/SKILL.md` (shipped — 5 ship at v1.0)
2. `~/.pi/agent/vibehack/specialists/learned/<kind>/SKILL.md` (operator-grown)

First match wins. Content prepended to Operator's system prompt. No code changes when adding a specialist — that's the inversion of the fenrir-harness pattern.

## Chain mode

```
Planner emits vibehack_propose_chain(root, steps[])
       ▼
chain_propose event written. Banner: "⚠ chain proposed"
       ▼
operator decides:
   /vibehack-chain-confirm           → run all steps sequentially
   /vibehack-chain-confirm --interactive → halt for confirm between steps
   /vibehack-chain-reject [reason]   → mark chain_reject, prune
       ▼
runChain():
   for each step:
     spawnOperator(input) with previous_handoff set
     if outcome === "falsified": halt with reason="falsified"
     prevHandoff = buildHandoff(out)
   return ChainResult { steps[], halted_at?, halt_reason? }
```

## ADR index

| ADR | Decision |
|---|---|
| [0001](adr/0001-event-sourced-jsonl.md) | Event-sourced JSONL as source of truth (no SQLite) |
| [0002](adr/0002-graphify-as-recall-substrate.md) | graphify as recall substrate (no vector DB) |
| [0003](adr/0003-before-provider-request-injection.md) | `before_provider_request` wire-layer injection (10× move) |
| [0004](adr/0004-prompt-template-model-as-dispatch.md) | pi-prompt-template-model as dispatch (no router provider) |
| [0005](adr/0005-pi-dcp-as-context-budget.md) | pi-dcp for working-context budget |
| [0006](adr/0006-subprocess-isolation-for-untrusted-output.md) | Subprocess isolation for untrusted output |
| [0007](adr/0007-unleashed-scope.md) | Unleashed scope (audit-log only) |
| [0008](adr/0008-vendoring-fallback-for-hard-deps.md) | Vendor-fork procedure for hard deps |
| [0009](adr/0009-specialists-as-skills-not-subagents.md) | Specialists as skills, not subagents |

## Tests as architecture documentation

122 vitest cases across 21 files exercise the architecture from below:

- `events-schema.test.ts` — schema invariants
- `tree-render.test.ts` — fold + render determinism + cycle guard
- `planner-tools.test.ts` — every Planner mutation tool's event-emission contract
- `hypothesis-or-die.test.ts` — invariant gate + anti-loop wording
- `dcp-rules.test.ts` — each DCP rule's prune logic
- `recall.test.ts` — graphify shell-out + grep fallback
- `recall-injection.test.ts` — wire-layer injection format
- `tool-ingest.test.ts` — 4 modes including specialist routing
- `specialist-loader.test.ts` — shipped + learned precedence
- `operator-output.test.ts` — return contract schema
- `chain-mode.test.ts` — proposal lookup
- `lessons.test.ts` — distillation + roundtrip
- `e2e/dvwa-smoke.test.ts` — full §5 walkthrough

Read those next when in doubt about behavior.
