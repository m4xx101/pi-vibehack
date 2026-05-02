# pi-vibehack

> Context-aware vibe-hacking on [pi-mono](https://github.com/badlogic/pi-mono). Hypothesis-tree REPL · graphify-backed wire-layer recall · on-the-fly tool synthesis. Bug bounty / pentest / CTF / red team / research.

[![npm](https://img.shields.io/badge/npm-%40m4xx101%2Fpi--vibehack-blue)](https://www.npmjs.com/package/@m4xx101/pi-vibehack)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![built for](https://img.shields.io/badge/built%20for-pi--mono-orange)](https://github.com/badlogic/pi-mono)
[![status](https://img.shields.io/badge/status-v1.0.0--rc1-yellow)](CHANGELOG.md)

> **AUTHORIZED TESTING ONLY.** The harness has unleashed scope by design. *You* are responsible for authorization, scope, and signed agreements. Do not point this at any system you do not own or have explicit, written permission to test. The `audit.log` is your forensic record. See [SECURITY.md](docs/SECURITY.md).

---

## What it is

pi-vibehack is a pi-mono extension that turns a pi window into a security-research engine that *thinks in hypotheses, executes in subprocesses, and remembers across engagements*. It is not a scan-and-shovel scripted scanner; it is not yet another LLM agent that monologues at a target. It is a **hypothesis-tree REPL** where the operator steers and the harness does the work — proactively, with a wire-layer recall substrate that makes the agent feel telepathic about prior engagements.

Every Planner turn must mutate the tree (hypothesis-or-die, enforced by hooks). Every leaf has a falsifier (no vibes-only claims). Every confirmation triggers an Operator subprocess that runs in `pi --mode json -p --no-session` isolation, returns schema-validated JSON, and never leaks raw target output back into the Planner's reasoning chain. Every confirmed leaf folds into a graphify graph that compounds across engagements — engagement #2 against a similar target *starts smarter than #1 finished*.

**The 10× move:** the `before_provider_request` hook reads the current open hypothesis, runs an embedding-similarity query against the global graphify graph, picks top-3 most-relevant subgraphs, and silently injects them into the Planner system prompt as a `<recall>` block — every turn, without the Planner ever calling a recall tool. No public security-agent harness does this today. See [ARCHITECTURE.md §The 10× move](docs/ARCHITECTURE.md#the-10x-move).

---

## The hypothesis-tree REPL

```
       operator types /vibehack target.example
                       │
                       ▼
            ┌───────────────────────┐
            │  Planner (main pi)    │ ◀──── before_provider_request
            │  reasons, mutates     │       injects <recall> block
            │  the tree only        │       from global graphify graph
            └──────────┬────────────┘
                       │  vibehack_expand / confirm / evidence / ...
                       ▼
        events.jsonl ── tree.md ── findings.md
                       │
                       │  on /confirm <leaf>
                       ▼
            ┌───────────────────────┐
            │ Operator subprocess   │ pi --mode json -p --no-session
            │ bash + recipes        │ structured JSON return only
            │ context-isolated      │ no Planner transcript leak
            └──────────┬────────────┘
                       │  outcome: confirmed | falsified | inconclusive | blocked-on-auth
                       ▼
            tool_result hook → negative-space synth → graphify update
                       │
                       ▼
              next Planner turn (smarter)
```

The whole loop is invariant-driven. Hooks enforce: hypothesis-or-die, falsifier-required, depth ≤ 6, breadth ≤ 8, sub-agent context isolation, cost-as-metadata. See [ARCHITECTURE.md §Loop invariants](docs/ARCHITECTURE.md#loop-invariants).

---

## Quickstart

```bash
# 1. Install pi-mono (if you haven't yet)
npm i -g @mariozechner/pi-coding-agent

# 2. Install pi-vibehack
npx -y @m4xx101/pi-vibehack install

# 3. Boot pi
pi

# 4. Start an engagement against an authorized target
/vibehack juice-shop.local

# 5. Watch the tree, steer when needed, wrap up when done
/vibehack-tree
/vibehack-complete
```

That's it. See [docs/QUICKSTART.md](docs/QUICKSTART.md) for a full first-run walkthrough with sample transcript.

---

## What's in the box (v1.0)

| Component | Count | Source |
|---|---|---|
| pi extension entry | 1 | `extensions/pi-vibehack/index.ts` |
| Lifecycle hooks | 6 | session_start · before_agent_start · tool_call · tool_result · before_provider_request · session_before_compact |
| Custom Planner tools | 8 | `vibehack_expand` · `_prune` · `_confirm` · `_evidence` · `_dead_end` · `_propose_chain` · `_propose_specialist` · `_recall` |
| pi-dcp rules | 4 | prune-stale-recall · prune-stale-tool-results · prune-folded-evidence · prune-dead-branches |
| Slash commands (prompt files) | 17 | `prompts/*.md` (15 core + 2 soft-companion) |
| Provider personas | 4 | `prompts/personas/{CLAUDE,CODEX,GEMINI,LOCAL}.md` |
| Recipe skills (bundled) | 9 | curl · super-curl · httpx · nuclei · ffuf · searchsploit · nmap · surf-cli · playwright-cli (8 active at any time — curl ↔ super-curl swap) |
| Role-recipe skills | 5 | planner / operator / reporter / distill / ingest |
| Specialist skills | 5 | web-recon · web-exploit · binary-recon · auth-bypass · osint |
| scurl templates | 3 | auth-bearer-probe · jwt-tamper · csrf-replay |
| Subagent role files | 2 | `subagents/vibehack-{operator,reporter}.md` |
| ADRs | 9 | `docs/adr/0001-…` to `0009-…` |
| Tests | 122 | across 9 vitest suites |

---

## The matrix-glitch features

These exist in pi-vibehack and (to our knowledge) **no public security-agent harness today**:

1. **graphify-backed `before_provider_request` injection.** Every Planner LLM call is silently grounded with relevant cross-engagement subgraphs *before* the request is sent. Wire-layer telepathy. ([ADR-0003](docs/adr/0003-before-provider-request-injection.md))
2. **On-the-fly tool synthesis with validation gate.** `/vibehack-ingest "wayback URL collector that paginates"` spawns a frontier-model Operator subprocess that *writes* the tool from scratch, validates against a known-safe target (`--validate-against`), and rolls back on failure. ([COMMANDS.md](docs/COMMANDS.md#vibehack-ingest))
3. **scurl `sendToAgent` round-trip for auth walls.** Operator hits a CSRF token / bearer wall → returns `outcome: "blocked-on-auth"` with a `scurl_template_request` → operator pastes the value into the scurl TUI → `sendToAgent` flows back → Operator subprocess respawns with the new auth profile. No flow break.
4. **Specialists-as-skills (not subagents).** Five specialists ship as single SKILL.md files; new ones grow via `/vibehack-ingest --specialist`. The fenrir trap (16 specialist subagents) inverted: same flexibility, ~zero structural complexity. ([ADR-0009](docs/adr/0009-specialists-as-skills-not-subagents.md))
5. **Negative-space synthesis.** Missing CSP/HSTS/SameSite, filtered-port absence, missing SPF/DMARC become *positive evidence events* tagged `synthetic: true` in the tree — without the Planner asking. ([ARCHITECTURE.md §Negative-space synthesis](docs/ARCHITECTURE.md#negative-space-synthesis))

---

## Three install profiles

| Profile | Planner | Operator | Reporter | When to use |
|---|---|---|---|---|
| `hybrid` *(default)* | `claude-haiku-4-5` | `claude-opus-4-7` | `claude-opus-4-7` | Daily driver. Fast steering, frontier execution. |
| `frontier` | `claude-sonnet-4-6` | `claude-opus-4-7` | `claude-opus-4-7` (xhigh) | Hard targets. Deep CTFs. |
| `local` | `qwen-72b-instruct` | `qwen-72b-instruct` | `qwen-72b-instruct` | Sensitive engagements. Air-gapped labs. No data egress. |

Per-role overrides via `--planner` / `--operator` / `--reporter` flags. See [INSTALL.md §Profiles](docs/INSTALL.md#profiles).

---

## Documentation

| Doc | What's in it |
|---|---|
| [QUICKSTART.md](docs/QUICKSTART.md) | 5-minute path to first engagement, full sample transcript |
| [INSTALL.md](docs/INSTALL.md) | Prerequisites, profiles, soft companions, project-scoped installs, local-model setup |
| [OPERATOR-GUIDE.md](docs/OPERATOR-GUIDE.md) | The operator's daily-use manual — mental model, tree verbs, auth walls, chains, specialists, ingest, pinning, handoff |
| [COMMANDS.md](docs/COMMANDS.md) | Complete slash command reference (17 commands + 4 personas) |
| [RECIPES.md](docs/RECIPES.md) | All 9 recipes, 5 role-recipes, 5 specialists, 3 scurl templates |
| [EXTENDING.md](docs/EXTENDING.md) | Add your own — recipes, specialists, tools, slash commands, DCP rules, hooks, providers |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Full architecture: 7 layers, 16 event types, six-memory model, sequence diagrams |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems and fixes |
| [FAQ.md](docs/FAQ.md) | Frequently asked questions |
| [SECURITY.md](docs/SECURITY.md) | Authorized-testing-only manifesto + responsible-use guidance |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Patches, tests, commit style |
| [ADRs](docs/adr/) | 9 architectural decision records (locked at design) |
| Spec | [`docs/superpowers/specs/2026-04-29-pi-vibehack-design.md`](docs/superpowers/specs/2026-04-29-pi-vibehack-design.md) |

---

## Acknowledgments

Built on top of [pi-mono](https://github.com/badlogic/pi-mono) by [Mario Zechner](https://github.com/badlogic). Composes the work of:

- [`pi-prompt-template-model`](https://github.com/nicobailon/pi-prompt-template-model) (nicobailon) — frontmatter-driven per-command dispatch
- [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter) (nicobailon) — lazy-discovery pattern referenced for v1.1
- [`surf-cli`](https://github.com/nicobailon/surf-cli) (nicobailon) — Chrome-control browser automation companion
- [`pi-dcp`](https://github.com/zenobi-us/pi-dcp) (zenobi-us) — Dynamic Context Pruning (hard dep)
- [`pi-super-curl`](https://github.com/Graffioh/pi-super-curl) (Graffioh) — HTTP/auth surface with `sendToAgent`
- [`memory-mode`](https://github.com/hjanuschka/shitty-extensions) and `handoff` (hjanuschka) — soft-companion patterns rewired as `/vibehack-pin` and auto-handoff
- [`agent-guidance`](https://github.com/tmustier/pi-extensions) (tmustier) — provider-persona pattern (CLAUDE/CODEX/GEMINI/LOCAL)
- [`graphify`](https://github.com/m4xx101/graphify) — recall substrate for cross-engagement memory
- [`fenrir-harness`](https://github.com/m4xx101/fenrir) — predecessor harness whose lessons (and traps) shaped this design

SOTA references that informed the design (verify before publishing): Project Naptime / Big Sleep, PentestGPT (USENIX 2024), HackingBuddyGPT, CAI, Cybench, EnIGMA / SWE-agent, NYU CTF Bench, XBOW.

---

## Status

This is **v1.0.0-rc1** — release candidate. Tagged at `ae3fb1e`. Tests: 122/122 across 9 vitest suites. Not yet published to npm under that exact tag (the `package.json` declares `1.0.0`; we will cut `v1.0.0` once external smoke testing closes). Known nits:

- Pre-existing `TS7016` warnings (untyped third-party JS imports) — non-blocking, see [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
- A `DEP0190` shell:true warning on Windows from one spawn site — non-blocking; tracked.
- `graphify` is a soft dep, not bundled — install separately to unlock the wire-layer recall ([ADR-0002](docs/adr/0002-graphify-as-recall-substrate.md)). Without it, `/vibehack` falls back to grep-over-events.jsonl and prints a banner. The harness still works.

---

## License

MIT — see [LICENSE](LICENSE).
