<div align="center">

# pi-vibehack

**Production-grade vibe-hacking harness for [pi-mono](https://github.com/badlogic/pi-mono).**
Hypothesis-tree REPL · graphify-backed cross-engagement memory · lazy tool loading · autonomous mode · CDP browser verifier.

[![npm](https://img.shields.io/npm/v/@m4xx101/vibeshack.svg?label=npm%20%40m4xx101%2Fvibeshack&color=blue)](https://www.npmjs.com/package/@m4xx101/vibeshack)
[![tests](https://img.shields.io/badge/tests-340%20passing-brightgreen)](#testing)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![pi-mono](https://img.shields.io/badge/built%20for-pi--mono-orange)](https://github.com/badlogic/pi-mono)

</div>

> ⚠️  **Authorized testing only.** This harness has unleashed scope by design — there are no built-in scope guards, rate limiters, or "are you sure?" walls between you and the target. **You** are responsible for written authorization, scope boundaries, and legal exposure. The `events.jsonl` per engagement is your forensic trail. See [SECURITY.md](docs/SECURITY.md).

---

## What it actually is

pi-vibehack turns a [pi-mono](https://github.com/badlogic/pi-mono) terminal into a structured offensive-security cockpit. Instead of a single chat thread that drifts, every claim becomes a node in a hypothesis tree with a falsifier. The harness enforces this with hooks — you cannot end a turn without mutating the tree. Three things make it different from a generic LLM agent pointed at a target:

1. **Hypothesis-tree REPL.** Every reasoning step is structured: `expand` → `evidence` → `confirm` or `dead-end`. Drift becomes visible as wide/deep open subtrees, not buried in chat scrollback.
2. **Cross-engagement recall.** Confirmed leaves fold into a [graphify](https://github.com/m4xx101/graphify) graph. The next engagement's `before_provider_request` hook silently injects the most similar prior subgraphs into the planner's system prompt — engagement #2 against a similar target *starts smarter than #1 finished*.
3. **Lazy tool loading + bug-bounty stack** *(v1.4)*. 30+ tool wrappers (subfinder, nuclei, sqlmap, ffuf, prowler, frida, …) are eagerly registered but dormant. The planner runs `vibehack_tool_search` → `vibehack_load_tools` to expose only what the surface needs. Same shape as CyberStrike's `LazyToolRegistry` — bounded context, full toolbox.

Everything runs in three context-isolated subprocesses (Planner / Operator / Reporter) so target output never poisons the planner's reasoning chain.

---

## Quick install

### One-liner (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/m4xx101/pi-vibehack/main/install.sh | bash
```

This installs pi-mono if missing, the vibehack package, and writes `~/.pi/agent/settings.json`. Inspect the script first if your security posture requires it (`curl -fsSL .../install.sh | less`).

### Or via npm

```bash
npm i -g @mariozechner/pi-coding-agent @m4xx101/vibeshack
pi-vibehack install
```

> The npm package is **`@m4xx101/vibeshack`** (a word-filter quirk on npm). Everything else — repo, slash commands, brand — is `pi-vibehack`.

### From source (for contributors)

```bash
git clone https://github.com/m4xx101/pi-vibehack
cd pi-vibehack
npm install --legacy-peer-deps
node bin/install.js install
```

### Update

```bash
pi-vibehack update     # from your shell
# or, inside pi:
/vibehack-update
```

Preserves `~/.pi/agent/vibehack/config.yaml`, hand-edited prompts, and all engagement data.

> Trouble installing? See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

---

## Your first 5 minutes

```bash
# 1. Boot pi (your default model + provider)
pi

# 2. Start an engagement (the only argument is the target)
/vibehack juice-shop.local

# 3. Discover relevant tools, load the ones you'll use
> "subdomain enumeration on example.com"
# planner calls vibehack_tool_search → vibehack_load_tools

# 4. Check what's growing
/vibehack-tree

# 5. Let it drive itself for 10 turns
/vibehack-auto 10

# 6. Wrap up
/vibehack-complete    # writes findings.md + graphify update
```

That's the whole loop. Everything else is steering.

---

## Worked example: SSRF on a fetch endpoint

```bash
$ pi
> /vibehack target.example.com
✓ engagement started: 2026-05-06-target-example-com (target: target.example.com)

> Use the ssrf persona and check the public-facing endpoints.

# Planner calls:
#   vibehack_use_persona({name:"ssrf"})           ← swaps system-prompt persona body
#   vibehack_expand({kind:"root", ...})           ← seeds the tree
#   vibehack_tool_search({query:"http probe"})    ← discovers httpx
#   vibehack_load_tools({tool_ids:["vibehack_run_httpx"]})
#   vibehack_run_httpx({args:["-u","https://target.example.com/api/fetch","-status-code"]})
#   vibehack_evidence(...)                        ← logs response shape
#   vibehack_canary_verify({node_id:"n_1a", kind:"SSRF"})  ← plants OOB canary
#   vibehack_browser_verify({url:"...", expectation:"document.title"})  ← attaches Chrome
#   vibehack_confirm({node_id:"n_1a", impact:"AWS IMDS reachable"})
#   vibehack_report_vuln({severity:"critical", cvss:9.1, cwe:"CWE-918", ...})

> /vibehack-tree
n_root  ▸  target.example.com
└─ n_1a [confirmed] SSRF on /api/fetch?url= (CVSS 9.1)

> /vibehack-complete
✓ report at engagements/2026-05-06-target-example-com/findings.md
```

The HackerOne-style markdown report is in the engagement directory; the structured `vuln_reported` event is in `events.jsonl`; the confirmed node is mirrored to the pi session JSONL via `pi.appendEntry` so `/resume` shows it.

---

## Slash commands at a glance

| Command | What it does |
|--|--|
| **Engagement** | |
| `/vibehack <target>` | Start (or resume) an engagement against `<target>`. Sets the pi session name to `vibehack: <target>`. |
| `/vibehack-tree` | Render the hypothesis tree as markdown. |
| `/vibehack-resume [id]` | Resume a paused engagement (latest if no id). |
| `/vibehack-pause` | Save state, generate handoff prompt. |
| `/vibehack-complete` | Write final report; cleanup canaries; refresh graphify. |
| `/vibehack-cost` | Show cost spent so far in the active engagement. |
| **Hypothesis steering** | |
| `/expand <claim>` | Manual node expansion. Most operators just type natural language; the planner expands. |
| `/confirm <node>` | Mark a node confirmed (operator override). |
| `/prune <node>` | Prune a subtree manually. |
| `/steer <text>` | Inject a free-text steering note for the next planner turn. |
| **Auto + memory** | |
| `/vibehack-auto <budget>` | **Real autonomous loop**. Drives `pi.sendUserMessage(...,{deliverAs:"followUp"})` per turn until budget exhausted, all open nodes resolved, or `/vibehack-auto stop`. `<budget>` is max turns (1–50). |
| `/vibehack-auto status` / `stop` | Inspect or halt the loop. |
| `/vibehack-pin <fact> [--global]` | Pin a fact to engagement (or global) AGENTS.md. |
| `/vibehack-handoff [id]` | Generate cross-session handoff prompt. |
| `/vibehack-distill` | Compress a long engagement's events into a summary. |
| `/vibehack-reflect` | Layer-B reflection: cluster confirmed leaves into reusable recipes. |
| **Tools + skills** | |
| `/vibehack-ingest "<spec>"` | Tool synthesis — operator subprocess writes a new tool / recipe / specialist from a natural-language spec, validates, lands. |
| `/vibehack-rescan-kali` | Refresh the Kali tool capability cache. |
| `/vibehack-config sync` | Regenerate prompt frontmatter from live config without clobbering hand-edits. |
| `/vibehack-update` | Self-update from npm; idempotent. |
| **Chains** | |
| `/vibehack-chain-confirm [--interactive]` | Run the most recently proposed exploit chain. |
| `/vibehack-chain-reject [reason]` | Reject the pending chain proposal. |
| **Optional integrations (auto-detected)** | |
| `/vibehack-rewind` | (needs [pi-rewind-hook](https://github.com/hjanuschka/shitty-extensions)) jump back to a prior turn. |
| `/vibehack-fork` | (needs [pi-side-chat](https://github.com/hjanuschka/shitty-extensions)) branch the engagement. |
| `/vibehack-evolve --bench <name>` | Run a bench; with `--mutate` spawns a mutator subagent in a worktree. |

Full reference: **[docs/COMMANDS.md](docs/COMMANDS.md)**.

---

## Planner tools (visible to the LLM)

The planner has 15 always-active tools plus 30+ lazy wrappers it can load on demand.

**Always active:**
- `vibehack_expand` / `vibehack_prune` / `vibehack_confirm` / `vibehack_evidence` / `vibehack_dead_end` — tree mutations
- `vibehack_propose_chain` / `vibehack_propose_specialist` — operator-gated proposals
- `vibehack_recall` — query the cross-engagement graph
- `vibehack_canary_verify` — plant filesystem / HTTP-callback / DNS canaries
- `vibehack_browser_verify` — attach to operator's Chrome (`--remote-debugging-port=9222`), navigate + evaluate JS + screenshot
- `vibehack_use_persona` — swap planner persona (general / ssrf / xss / sqli / idor / auth-bypass / cloud / mobile / api / ad)
- `vibehack_report_vuln` — HackerOne-style markdown + structured event (severity gates `critical`/`high` behind `ctx.ui.confirm`)
- `vibehack_tool_search` — search 30+ catalog entries; returns `{id, installed, loaded}`
- `vibehack_load_tools` / `vibehack_unload_tools` — mutate the active set; loaded wrappers appear on the next turn

**Lazy wrappers (loaded on demand):** `vibehack_run_subfinder`, `_nuclei`, `_sqlmap`, `_ffuf`, `_amass`, `_naabu`, `_httpx`, `_nikto`, `_nmap`, `_prowler`, `_frida`, `_nxc` (NetExec), `_curl`, `_wpscan`, … (full list via `vibehack_tool_search` with empty query).

---

## What separates v1.4

| Capability | What's actually wired |
|--|--|
| **Hypothesis tree** | 9 schema-validated event types · `additionalProperties:false` · cross-field invariants in `validateEvent()` |
| **Cross-engagement recall** | `before_provider_request` hook injects top-3 graphify subgraphs as `<recall>` block — every turn, no tool call |
| **Real autonomous loop** | `agent_end` hook fires `pi.sendUserMessage(...,{deliverAs:"followUp"})`; halts on budget / completion / operator stop |
| **Lazy tool loading** | CyberStrike's `LazyToolRegistry` pattern via `pi.setActiveTools()` — only loaded wrappers eat context |
| **CDP browser verifier** | Zero-dep CDP client (~200 LoC over `node:net` + `node:http`); attaches to operator's Chrome on `:9222` |
| **Persona switching** | 9 ready-made personas with body text injected into `before_agent_start` system prompt |
| **HackerOne-style reports** | `vibehack_report_vuln` writes markdown + appends `vuln_reported` event; `ctx.ui.confirm` gates critical/high |
| **`pi.appendEntry` mirror** | Every vibehack event lands in pi's session JSONL too; `/resume` shows the move history |
| **Native AGENTS.md / SYSTEM.md** | Uses pi-mono's resource-loader (`resource-loader.js:31, 662, 666, 673, 677`); no duplicate stuffing |
| **Type-safety** | Every hook fully typed against `@mariozechner/pi-coding-agent` exports; no `(event:any, ctx:any)` |
| **`prepareArguments` shims** | Every tool tolerates LLM field-name drift (`nodeId`→`node_id`, `vulnClass`→`kind`, etc.) before TypeBox validation |

See [CHANGELOG.md](CHANGELOG.md) for the full v1.0 → v1.4 evolution and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deep dive.

---

## Configuration

`~/.pi/agent/vibehack/config.yaml` (created by the installer):

```yaml
version: 1
models:
  planner: claude-haiku-4-5      # cheap, fast steering
  operator: claude-opus-4-7      # frontier execution
  reporter: claude-opus-4-7
  fallbacks:
    planner: []
    operator: []
    reporter: []
auto_install:
  enabled: true                  # auto-prompt for soft companions on session_start
  allow_npm: true
  fallback_on_decline: true
ui:
  banner:
    show_last_turn_cost: true
    show_engagement_cost: true
    cost_warn_threshold_usd: 0.5
vibehack:
  agentsMdCompat: false          # v1.2 dual-load AGENTS.md (set true if pi-mono < 0.10)
```

After editing: `/vibehack-config sync` (regenerates prompt frontmatter without clobbering hand edits).

---

## Profiles

| Profile | Planner | Operator | Reporter | When |
|--|--|--|--|--|
| `hybrid` *(default)* | `claude-haiku-4-5` | `claude-opus-4-7` | `claude-opus-4-7` | Daily driver. Cheap steering, frontier execution. |
| `frontier` | `claude-sonnet-4-6` | `claude-opus-4-7` | `claude-opus-4-7` | Hard targets, deep CTFs. |
| `local` | `qwen-72b-instruct` | `qwen-72b-instruct` | `qwen-72b-instruct` | Sensitive engagements, air-gapped labs. |

Set at install: `--profile hybrid|frontier|local`. Override per role: `--planner gpt-5 --operator claude-opus-4-7`.

---

## Optional companions (auto-detected)

When present in `~/.pi/agent/extensions/` or `~/.pi/agent/skills/`, these light up automatically:

| Extension | Adds |
|--|--|
| [`pi-super-curl`](https://github.com/Graffioh/pi-super-curl) | HTTP/auth surface with `sendToAgent` round-trip for CSRF/bearer walls. |
| [`surf-cli`](https://github.com/nicobailon/surf-cli) | Chrome browser automation companion (browser-verifier specialist falls back to it before CDP). |
| [`graphify`](https://github.com/m4xx101/graphify) | Cross-engagement memory substrate. Without it, recall falls back to grep-over-events. |
| [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter) | MCP tool surface. |
| [`memory-mode`](https://github.com/hjanuschka/shitty-extensions) | Long-term operator memory. |
| [`handoff`](https://github.com/hjanuschka/shitty-extensions) | Cross-session handoff. |
| [`pi-rewind-hook`](https://github.com/hjanuschka/shitty-extensions) | Unlocks `/vibehack-rewind`. |
| [`pi-side-chat`](https://github.com/hjanuschka/shitty-extensions) | Unlocks `/vibehack-fork`. |
| [`pi-dcp`](https://github.com/zenobi-us/pi-dcp) | Dynamic Context Pruning — the install pre-pins exact version so pi-mono's reinstall check passes. |

Installer asks for consent before pulling missing ones (`auto_install.enabled: false` opts out).

---

## Browser verifier setup

`vibehack_browser_verify` attaches to a Chrome you run yourself — no Patchright dependency.

```bash
# Mac
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/vh-chrome

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/vh-chrome

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir=%TEMP%\vh-chrome
```

Open the tab you want verified, then ask the planner. If Chrome isn't running, the tool returns `{error:"no-chrome-attached", hint:"start Chrome with --remote-debugging-port=9222"}` — never throws.

---

## Documentation

| Doc | What's in it |
|--|--|
| [QUICKSTART.md](docs/QUICKSTART.md) | 5-minute first engagement with sample transcript |
| [INSTALL.md](docs/INSTALL.md) | Profiles, soft deps, project-scoped installs, local-model setup |
| [OPERATOR-GUIDE.md](docs/OPERATOR-GUIDE.md) | Daily-use manual: tree verbs, auth walls, chains, specialists, ingest, pinning, handoff |
| [COMMANDS.md](docs/COMMANDS.md) | Complete slash-command reference |
| [RECIPES.md](docs/RECIPES.md) | Recipes, role-recipes, specialists, scurl templates |
| [EXTENDING.md](docs/EXTENDING.md) | Add your own — recipes, specialists, tools, slash commands, DCP rules, hooks, providers |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 7 layers, event taxonomy, six-memory model, sequence diagrams |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems and fixes |
| [FAQ.md](docs/FAQ.md) | Frequently asked questions |
| [SECURITY.md](docs/SECURITY.md) | Authorized-testing manifesto + responsible-use guidance |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | Patches, tests, commit style |
| [ADRs](docs/adr/) | Architectural decision records |

---

## Testing

```bash
npm test
```

**340 tests across 60 vitest files**, including end-to-end integration tests:

- Persona body actually lands in the system prompt
- `vibehack_report_vuln` actually appends to `events.jsonl`
- `/vibehack-auto` actually drives `pi.sendUserMessage` per turn
- Lazy tool loading actually flips `loaded` flag in subsequent searches
- CDP client actually parses `/json/list` and handles handshake failure cleanly

The test suite is the contract. If you find a regression that the suite doesn't catch, file an issue with a vitest reproduction — that's the highest-quality bug report shape.

---

## Architecture in one paragraph

The harness is a pi-mono extension. It registers tools (mutating + meta), hooks (`session_start`, `before_agent_start`, `tool_call`, `tool_result`, `before_provider_request`, `agent_end`, `session_before_compact`, `resources_discover`), and slash commands. Engagement state lives at `~/.pi/agent/vibehack/engagements/<id>/events.jsonl` — append-only, schema-validated, mirrored to pi's session JSONL via `pi.appendEntry`. The `before_provider_request` hook embeds the current open hypothesis, queries graphify for similar prior subgraphs, and injects them as `<recall>` into the planner's system prompt. The `agent_end` hook drives the autonomous loop. Tools are eagerly registered but inactive; `vibehack_load_tools` flips them via `pi.setActiveTools()`. Confirmed leaves write back to graphify so engagement N+1 starts smarter than N. ([ARCHITECTURE.md](docs/ARCHITECTURE.md) has the full version.)

---

## Acknowledgments

Built on top of [pi-mono](https://github.com/badlogic/pi-mono) by [Mario Zechner](https://github.com/badlogic). Composes the work of:

- [`pi-prompt-template-model`](https://github.com/nicobailon/pi-prompt-template-model) — frontmatter-driven per-command dispatch
- [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter) — lazy-discovery pattern for MCP tools
- [`surf-cli`](https://github.com/nicobailon/surf-cli) — Chrome-control browser automation
- [`pi-dcp`](https://github.com/zenobi-us/pi-dcp) — Dynamic Context Pruning
- [`pi-super-curl`](https://github.com/Graffioh/pi-super-curl) — HTTP/auth surface with `sendToAgent`
- [`memory-mode`](https://github.com/hjanuschka/shitty-extensions) and `handoff` (hjanuschka)
- [`agent-guidance`](https://github.com/tmustier/pi-extensions) — provider-persona pattern
- [`graphify`](https://github.com/m4xx101/graphify) — cross-engagement recall substrate
- [`CyberStrike`](https://github.com/CyberStrikeus/CyberStrike) — lazy tool loading + autonomous-loop pattern (v1.4)

SOTA references that informed the design: Project Naptime / Big Sleep, PentestGPT (USENIX 2024), HackingBuddyGPT, CAI, Cybench, EnIGMA / SWE-agent, NYU CTF Bench, XBOW.

---

## Status

**v1.4.1** — published as `@m4xx101/vibeshack@latest`. 340 tests passing. Active development.

## License

[MIT](LICENSE).
