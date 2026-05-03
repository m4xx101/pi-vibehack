# pi-vibehack

> Context-aware vibe-hacking on [pi-mono](https://github.com/badlogic/pi-mono). Hypothesis-tree REPL · graphify-backed wire-layer recall · on-the-fly tool synthesis. Bug bounty / pentest / CTF / red team / research.

[![npm](https://img.shields.io/badge/npm-%40m4xx101%2Fpi--vibehack-blue)](https://www.npmjs.com/package/@m4xx101/vibeshack)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![built for](https://img.shields.io/badge/built%20for-pi--mono-orange)](https://github.com/badlogic/pi-mono)
[![status](https://img.shields.io/badge/status-v1.1.0--rc1-yellow)](CHANGELOG.md)

> **AUTHORIZED TESTING ONLY.** The harness has unleashed scope by design. *You* are responsible for authorization, scope, and signed agreements. Do not point this at any system you do not own or have explicit, written permission to test. The `audit.log` is your forensic record. See [SECURITY.md](docs/SECURITY.md).

---

## What it is

pi-vibehack is a pi-mono extension that turns a pi window into a security-research engine that *thinks in hypotheses, executes in subprocesses, and remembers across engagements*. It is not a scan-and-shovel scripted scanner; it is not yet another LLM agent that monologues at a target. It is a **hypothesis-tree REPL** where the operator steers and the harness does the work — proactively, with a wire-layer recall substrate that makes the agent feel telepathic about prior engagements.

Every Planner turn must mutate the tree (hypothesis-or-die, enforced by hooks). Every leaf has a falsifier (no vibes-only claims). Every confirmation triggers an Operator subprocess that runs in `pi --mode json -p --no-session` isolation, returns schema-validated JSON, and never leaks raw target output back into the Planner's reasoning chain. Every confirmed leaf folds into a graphify graph that compounds across engagements — engagement #2 against a similar target *starts smarter than #1 finished*.

**The 10× move:** the `before_provider_request` hook reads the current open hypothesis, runs an embedding-similarity query against the global graphify graph, picks top-3 most-relevant subgraphs, and silently injects them into the Planner system prompt as a `<recall>` block — every turn, without the Planner ever calling a recall tool. No public security-agent harness does this today. See [ARCHITECTURE.md §The 10× move](docs/ARCHITECTURE.md#the-10x-move).

---

## What separates pi-vibehack

- **Hypothesis-tree REPL** — every claim becomes a child node with falsifier branches. Drift is structural, not buried in chat history.
- **On-the-fly tool synthesis** — `/vibehack-ingest` builds tools mid-engagement (scurl auth-flows, MCP servers, recipe SKILL.md, specialist SKILL.md).
- **Wire-layer recall** — graphify-backed past-engagement context injected at `before_provider_request` (not just session-start memory).
- **3-role subprocess isolation** — Planner / Operator / Reporter run as separate `pi --mode json -p --no-session` subprocesses. No prompt-pollution.
- **Skills-first methodology** — drops in alongside operator's existing `~/.pi/agent/skills/`; recipes/specialists are first-class.
- **Live cost telemetry** *(v1.0.1)* — `⚡ $X (last turn)` surfaces runaway operator subprocesses immediately.
- **Self-evolving harness** *(v1.1)* — Layer B reflection on `session_before_compact` (auto-writes refined recipes to `~/.pi/agent/vibehack/skills/learned/`); Layer A bench-driven mutation via `/vibehack-evolve --mutate` (worktree-isolated, regression-gated).
- **Kali tool auto-discovery** *(v1.1)* — 76-tool curated catalog across 8 categories; cached per-session; `/vibehack-rescan-kali` for manual refresh; Kali-MCP soft companion detection.
- **Browser-CDP verifier** *(v1.1)* — `browser-verifier` specialist + `verification_advisory` system-prompt injection for unverified browser-class confirms (DOM-XSS, reflected/stored-XSS, open-redirect, clickjacking, postMessage-leak, subdomain-takeover).
- **Canary primitives** *(v1.1)* — `vibehack_canary_verify` Planner tool plants filesystem/HTTP-callback/DNS canaries; OOB collector pinned via `/vibehack-pin canary-collector: <url>` for blind classes.
- **Auto-leverage existing pi extensions** *(v1.1)* — detects `~/.pi/agent/extensions/` and registers 5 integrations when present (pi-mcp-adapter, memory-mode, handoff, pi-rewind-hook, pi-side-chat); operator's existing skills surface as `recipe_hints` in `<recall>`.

See [docs/COMPARISON.md](docs/COMPARISON.md) for the side-by-side feature table vs H-mmer, XBOW, pentagi.

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

## Install

### Recommended: curl-pipe one-liner

```bash
curl -fsSL https://raw.githubusercontent.com/m4xx101/pi-vibehack/main/install.sh | bash
```

Sleek banner, 5-step indicator, installs pi-mono if missing, handles transitive postinstall failures automatically, detects WSL PATH-shadowing. Inspect the script before piping if your security posture requires it (`curl -fsSL .../install.sh | less`).

### Alternative: direct npm

```bash
npm i -g @mariozechner/pi-coding-agent
npm i -g @m4xx101/vibeshack
pi-vibehack install
```

The npm package name is `@m4xx101/vibeshack` (word-filter quirk); the harness, repo, slash commands, and brand are all `pi-vibehack`.

### Manual (clone-and-run — offline installs and contributors)

```bash
git clone https://github.com/m4xx101/pi-vibehack
cd pi-vibehack
npm install --legacy-peer-deps
node bin/install.js install
```

Works without npm registry access if you mirror the repo internally.

### Optional flags

```bash
# Pick a model profile (hybrid is default):
curl -fsSL .../install.sh | bash -s -- --profile local
curl -fsSL .../install.sh | bash -s -- --planner gpt-5 --operator claude-opus-4-7
```

> 💡 If install fails or you're on WSL with PATH issues, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

See [`docs/INSTALL.md`](docs/INSTALL.md) for profile flags, custom local providers, project-scoped installs, and troubleshooting.

---

## Quickstart

```bash
# After installing (any of the three paths above):
pi
/vibehack juice-shop.local            # start engagement
/vibehack-tree                         # view hypothesis tree
/vibehack-complete                     # write final report
```

See [docs/QUICKSTART.md](docs/QUICKSTART.md) for a full first-run walkthrough with sample transcript.

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

### New in v1.0.1

- **User-configurable models** via `~/.pi/agent/vibehack/config.yaml` — `bin/install.js --planner/--operator/--reporter` writes role assignments; `/vibehack-config sync` regenerates prompt frontmatter from the live config without clobbering hand-edits.
- **Soft-dep auto-install with consent** — `session_start` detects missing soft companions (pi-super-curl, surf-cli, graphify) and offers a single batched install prompt; `auto_install.enabled: false` opts out and restores the legacy banner.
- **Live cost telemetry** in the status banner — `⚡ $X (last turn)` surfaces runaway Operator subprocesses immediately and turns red above `cost_warn_threshold_usd`.

### New in v1.1.0

- **Self-evolving harness** — Layer B reflection (`extensions/pi-vibehack/lib/reflection.ts`) clusters confirmed leaves by stack signature on `session_before_compact` / `/vibehack-complete` / manual `/vibehack-reflect`, writing refined recipes to `~/.pi/agent/vibehack/skills/learned/<slug>/SKILL.md`. Operator-edited recipes are detected and never clobbered. Layer A: `/vibehack-evolve --bench <name>` runs `bench/<name>/up.sh` → engagement → evaluator → `down.sh`; `--mutate` spawns the `vibehack-mutator` subagent in a git worktree and only lands the mutation if the target bench passes AND the regression suite stays green.
- **Kali tool auto-discovery** — `KALI_TOOLS` catalog of 76 tools across 8 categories (recon/exploit/crack/forensic/network/web_api/mobile/misc). `detectKaliCapabilities()` runs at `session_start` and caches to `~/.pi/agent/vibehack/.capabilities.json`. Manual refresh via `/vibehack-rescan-kali`. Kali-MCP companion (`mcp-kali-server` / `zebbern-kali-mcp`) detected and banner-announced.
- **Auto-leverage existing pi extensions** — Extension detector scans `~/.pi/agent/extensions/`, `<cwd>/.pi/extensions/`, and `~/.pi/agent/skills/`. 5 integrations auto-activate when their corresponding extension is present: `pi-mcp-adapter`, `memory-mode`, `handoff`, `pi-rewind-hook`, `pi-side-chat`. Operator's `~/.pi/agent/skills/<dir>/SKILL.md` files surface as `recipe_hints` inside the `<recall>` block. New soft commands `/vibehack-rewind` (needs pi-rewind-hook) and `/vibehack-fork` (needs pi-side-chat).
- **Browser-CDP verifier** — `skills/specialists/browser-verifier/SKILL.md` verifies browser-class confirms via headless Chrome (surf-cli → playwright → CDP fallback), capturing screenshot + DOM + console + network. A `<verification_advisory>` block is injected at `before_agent_start` between `<bounds_advisory>` and `<recall>` whenever a browser-class confirm lacks prior verification (DOM-XSS, reflected-XSS, stored-XSS, open-redirect, clickjacking, postMessage-leak, subdomain-takeover). The `tool_result` hook validates the screenshot artifact (exists + non-zero size) before emitting `verification_pass`; missing or empty downgrades to `verification_advisory`.
- **Canary primitives** — `extensions/pi-vibehack/lib/canary.ts` provides `plantFileCanary` / `plantHttpCallbackCanary` / `verifyCanary` / `cleanupCanaries`. New Planner tool `vibehack_canary_verify(node_id, kind)` supports 6 kinds: RCE/AFR (filesystem), SSRF/open-redirect (HTTP callback), DNS/blind-OOB (operator-pinned collector subdomain via `/vibehack-pin canary-collector: <url>`). HTTP listener uses an ephemeral port (`:0`); cleanup runs at `/vibehack-complete`.
- **Schema additions** — 4 new event types in `event-schema.ts`: `verification_pass`, `verification_fail`, `verification_advisory`, `canary_planted`. All use the Phase 5 envelope (`event:` discriminator + `engagement_id`), all have `additionalProperties: false`, all backward-compatible with v1.0.0-rc1 `events.jsonl`.

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

This is **v1.1.0** — published on npm as `@m4xx101/vibeshack@latest`. Tests: 263/263 across 38 vitest files. Predecessor: `v1.0.1-rc1` (commit `07e8856`). Known nits:

- Pre-existing `TS7016` warnings (untyped third-party JS imports) — non-blocking, see [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
- A `DEP0190` shell:true warning on Windows from one spawn site — non-blocking; tracked.
- `graphify` is a soft dep, not bundled — install separately to unlock the wire-layer recall ([ADR-0002](docs/adr/0002-graphify-as-recall-substrate.md)). Without it, `/vibehack` falls back to grep-over-events.jsonl and prints a banner. The harness still works.

---

## License

MIT — see [LICENSE](LICENSE).
