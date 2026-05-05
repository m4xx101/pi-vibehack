# Commands & Tools Reference

Complete reference for every slash command and every Planner tool exposed by pi-vibehack v1.4.

> 📦 **Slash commands** are operator-driven: you type them in the pi prompt.
> 🤖 **Planner tools** are LLM-driven: the planner calls them to mutate the hypothesis tree, dispatch verifiers, plant canaries, etc.

---

## 1. Engagement lifecycle

### `/vibehack <target>`
Start a new engagement against `<target>` (or resume the existing one if a slug match is found).

```text
/vibehack juice-shop.local
/vibehack 192.0.2.10
/vibehack https://api.example.com
```

What it does:
1. Creates `~/.pi/agent/vibehack/engagements/YYYY-MM-DD-<slug>/` (event log + reports live here).
2. Writes `.active` marker so subsequent commands resolve the engagement.
3. Emits an `engagement_start` event into `events.jsonl`.
4. Calls `pi.setSessionName('vibehack: <target>')` so `/resume` shows the human-readable name.

After this, just type natural-language directives (`"enumerate the public API surface"`) and the planner drives.

### `/vibehack-tree`
Render the current hypothesis tree as markdown. Open nodes are `▢`, in-flight `▶`, confirmed `✅`, dead `✕`.

### `/vibehack-resume [engagement-id]`
Resume the latest paused engagement (or a specific one if you pass an id like `2026-05-06-target-example-com`).

### `/vibehack-pause`
Save state, generate a handoff prompt, mark the engagement paused. The next `/vibehack-resume` reads the handoff so the LLM doesn't have to re-discover what was open.

### `/vibehack-complete`
Wrap up the engagement:
1. Generate `findings.md` (HackerOne-style aggregated report).
2. Run `cleanupCanaries()` (un-plant filesystem canaries, stop HTTP listeners).
3. Refresh the graphify graph so the next engagement benefits.
4. Mark the engagement `completed` in `events.jsonl`.

### `/vibehack-cost`
Print cost breakdown for the active engagement. Tools sorted by spend.

```text
Engagement 2026-05-06-target-example-com: $0.4732
  vibehack_run_nuclei: $0.1820
  vibehack_browser_verify: $0.1014
  vibehack_evidence: $0.0998
```

---

## 2. Hypothesis steering

Most operators don't use these manually — the planner calls the equivalent tools. They're here for forced overrides.

### `/expand <claim>`
Manually add a node. Accepts free text; the planner picks `kind` and parent.

### `/confirm <node-id>` / `/prune <node-id>`
Operator override of a node's status. Use when the planner gets stuck.

### `/steer <text>`
Inject a free-text steering note that lands in the next planner turn's `<operator_steer>` block.

```text
/steer Don't touch admin.* until I get auth approval; focus on the public API for now.
```

---

## 3. Autonomous mode (v1.4)

### `/vibehack-auto <budget>`
Start the autonomous loop. `<budget>` is max turns, clamped to `[1, 50]`.

```text
/vibehack-auto 10
```

What happens:
1. Writes `<auto_mode budget=10>` policy block into the next planner turn.
2. After every `agent_end`, the `agent-end` hook calls `pi.sendUserMessage("[auto-mode turn N/10] continue: ...", {deliverAs:"followUp"})`.
3. Loop halts when:
   - Budget exhausted (`turns_used >= max_turns`)
   - All open nodes are confirmed/dead-ended (`foldNodes` reports zero open)
   - Operator runs `/vibehack-auto stop`
   - `pi.sendUserMessage` errors

### `/vibehack-auto stop`
Halt the loop immediately. Persists `halted_reason: "operator stop"`.

### `/vibehack-auto status`
Print current state: `enabled=true turns=3/10 halted=...`.

---

## 4. Memory & handoff

### `/vibehack-pin <fact> [--global]`
Pin a fact to AGENTS.md. Without `--global`, lands in the engagement's AGENTS.md (the planner sees it on every turn). With `--global`, lands in `~/.pi/agent/vibehack/AGENTS.md` (shared across engagements).

```text
/vibehack-pin canary-collector: https://my-collector.oast.fun
/vibehack-pin --global Always start with subfinder before nuclei
```

### `/vibehack-handoff [engagement-id]`
Generate a self-contained handoff prompt summarizing open nodes, recent evidence, and next tests. Useful when swapping models or when context is about to compact.

### `/vibehack-distill`
Compact a long engagement's events into a shorter summary that `before_provider_request` uses as the recall basis. Run when the engagement gets too large for graphify queries to be useful.

### `/vibehack-reflect`
**Layer-B reflection.** Cluster confirmed leaves by stack signature, write refined recipes to `~/.pi/agent/vibehack/skills/learned/<slug>/SKILL.md`. Operator-edited recipes are detected and never overwritten. Auto-runs on `session_before_compact` and `/vibehack-complete`; this command forces it manually.

---

## 5. Tool / capability ingest

### `/vibehack-ingest "<spec>"`
Tool synthesis. The operator subprocess writes a new tool / recipe / specialist from a natural-language spec, validates against a known-safe target, lands or rolls back.

```text
/vibehack-ingest "wayback URL collector that paginates and dedupes"
/vibehack-ingest --specialist "OAuth flow analyzer"
/vibehack-ingest --recipe "burp-style request replay with macro support"
```

Validation: the synthesized tool must complete a smoke test against `--validate-against <target>` (default: a built-in dummy target). Failures produce a diagnostic log and don't pollute the active set.

### `/vibehack-rescan-kali`
Manually refresh `~/.pi/agent/vibehack/.capabilities.json`. Auto-runs at `session_start`; rerun after installing new Kali tools.

---

## 6. Chains

The planner can `vibehack_propose_chain` to stage a multi-step exploit. The operator approves before execution.

### `/vibehack-chain-confirm [--interactive]`
Run the most recent proposed chain. `--interactive` prompts before each step via `ctx.ui.confirm`.

### `/vibehack-chain-reject [reason]`
Reject the pending chain proposal. Reason is logged.

---

## 7. Self-update + config

### `/vibehack-update`
Self-update from npm. Idempotent. Equivalent to `pi-vibehack update` from your shell. After update, `/reload` or restart pi.

### `/vibehack-config sync`
Regenerate prompt frontmatter (model assignments, etc.) from `~/.pi/agent/vibehack/config.yaml`. **Never clobbers operator-edited frontmatter** — uses a checksum sentinel to detect hand edits.

### `/vibehack-config show`
Print the resolved config (after migration / defaults).

---

## 8. Optional integrations (auto-detected)

These commands appear only when their backing extension is installed in `~/.pi/agent/extensions/`:

### `/vibehack-rewind` (needs [`pi-rewind-hook`](https://github.com/hjanuschka/shitty-extensions))
Jump back to a prior turn. Useful when the planner makes a wrong commit and you want to retry from before that point.

### `/vibehack-fork` (needs [`pi-side-chat`](https://github.com/hjanuschka/shitty-extensions))
Branch the engagement into a side conversation that doesn't pollute the main planner thread.

### `/vibehack-evolve --bench <name>`
Run a bench from `bench/<name>/up.sh` → engagement → evaluator → `down.sh`. With `--mutate`, spawns the `vibehack-mutator` subagent in a git worktree; lands the mutation only if the target bench passes AND the regression suite stays green. **Self-evolving harness, Layer A.**

---

## 9. Provider personas (v1.3+)

Set the planner's voice via the `vibehack_use_persona` tool. Bundled personas:

| Persona | Domain |
|--|--|
| `general` | Default — broad recon and exploitation |
| `ssrf` | Server-Side Request Forgery (IMDS pivots, internal-only headers, blind SSRF) |
| `xss` | Reflected / stored / DOM XSS, CSP bypass, sink discovery |
| `sqli` | SQL injection (boolean blind, time-based, union, second-order) |
| `idor` / `bola` | Object-level authorization bypass, ID enumeration, role abuse |
| `auth-bypass` | JWT tampering, OAuth flows, session fixation, MFA bypass |
| `cloud` | AWS / GCP / Azure misconfig, IAM, IMDS, S3 bucket abuse |
| `mobile` | Android / iOS reverse engineering, Frida, certificate pinning bypass |
| `api` | REST / GraphQL / gRPC enumeration and abuse |
| `ad` | Active Directory, Kerberos, ACL abuse, BloodHound |

The planner can switch with `vibehack_use_persona({name:"ssrf"})`. The persona body lands in the next `before_agent_start` system prompt.

---

# Planner Tools (LLM-callable)

15 always-active tools, plus 30+ lazy wrappers loaded on demand.

## Tree mutations

### `vibehack_expand({node_id?, parent_id?, kind, claim, next_test, falsifier, ...})`
Add a child node under `parent_id` (or root). `kind` is one of `root | surface | hypothesis | leaf`. Every leaf MUST have a `falsifier` per the no-vibes-only invariant.

### `vibehack_prune({node_id, rationale})`
Mark a subtree pruned. The DCP rules fold pruned subtrees out of context.

### `vibehack_confirm({node_id, impact, evidence})`
Mark a node confirmed. Triggers the operator subprocess and the negative-space synth.

### `vibehack_evidence({node_id, evidence:[{kind, ref, summary}]})`
Append evidence rows to a node without confirming.

### `vibehack_dead_end({node_id, rationale})`
Commit to a falsified branch.

## Operator-gated proposals

### `vibehack_propose_chain({steps:[{action, expected_outcome, ...}]})`
Stage a multi-step exploit chain. Operator runs `/vibehack-chain-confirm` to execute.

### `vibehack_propose_specialist({node_id, specialist, why})`
Propose dispatching a specialist. Operator approves.

## Recall + verification

### `vibehack_recall({query})`
Query the graphify graph for similar past evidence. **Note:** `before_provider_request` already auto-injects the top-3 most-similar subgraphs. Call this only for explicit, targeted lookups.

### `vibehack_canary_verify({node_id, kind})`
Plant a canary. Six kinds:

| `kind` | Mechanism |
|--|--|
| `RCE` | Filesystem canary at engagement workspace |
| `AFR` | Filesystem canary (Arbitrary File Read) |
| `SSRF` | HTTP-callback canary (ephemeral local listener) |
| `open-redirect` | HTTP-callback canary |
| `DNS` | Operator-pinned OOB collector subdomain |
| `blind-OOB` | Operator-pinned OOB collector |

For DNS / blind-OOB, set the collector first: `/vibehack-pin canary-collector: https://your.oast.fun`.

When `ctx.hasUI=true`, the tool prompts `ctx.ui.confirm` before planting (60s timeout, decline → `{error:"user-blocked"}`). Print/RPC mode skips the prompt.

### `vibehack_browser_verify({url, expectation?, port?, host?, timeout_ms?})`
Attach to operator's Chrome at `--remote-debugging-port=9222`, navigate to `url`, optionally evaluate `expectation` as JS, return result + base64 PNG screenshot.

```js
vibehack_browser_verify({
  url: "https://target.example.com/?q=<svg/onload=alert(1)>",
  expectation: "document.title.includes('XSS')",
  timeout_ms: 10000,
})
```

When Chrome isn't running:
```json
{"error":"no-chrome-attached", "hint":"start Chrome with --remote-debugging-port=9222 (got: connect ECONNREFUSED 127.0.0.1:9222)"}
```

## Persona + reporting

### `vibehack_use_persona({name})`
Swap the planner persona. Body text lands in the next `before_agent_start` system prompt under `<persona name=...>`.

### `vibehack_report_vuln({severity, title, affected_url, impact, reproduction_steps, ...})`
Generate a HackerOne-style markdown report at `engagements/<id>/reports/<slug>.md` AND emit a `vuln_reported` event to `events.jsonl`. Required fields:

| Field | Description |
|--|--|
| `severity` | `critical \| high \| medium \| low \| info` |
| `title` | Short title |
| `affected_url` | Endpoint / asset |
| `impact` | What's at risk |
| `reproduction_steps` | Array of steps |

Optional: `cvss` (0–10), `cwe`, `owasp`, `node_id` (back-link to tree), `evidence_paths`.

When `ctx.hasUI=true` and severity is `critical` or `high`, `ctx.ui.confirm` gates the write (60s timeout, decline → `{error:"user-blocked"}`).

## Tool discovery + dynamic loading (v1.4)

### `vibehack_tool_search({query?, domain?, installed_only?, limit?})`
Search the catalog. Returns:

```json
{
  "query": "subdomain enumeration",
  "total_in_catalogue": 32,
  "total_installed": 18,
  "total_loaded": 0,
  "matches": [
    {
      "id": "vibehack_run_subfinder",
      "name": "subfinder",
      "domain": ["recon"],
      "capabilities": ["subdomain enumeration", "passive DNS"],
      "description": "Fast passive subdomain enumeration",
      "example": "subfinder -d example.com -silent",
      "installed": true,
      "loaded": false
    }
  ],
  "hint": "Call vibehack_load_tools({tool_ids:['<id>']}) to make a tool callable in the next turn."
}
```

### `vibehack_load_tools({tool_ids})`
Activate one or more wrappers for the next turn. Updates `engagements/<id>/.loaded-tools`. Before each turn, `before-agent-start` calls `pi.setActiveTools([...base, ...loaded])`.

### `vibehack_unload_tools({tool_ids})`
Remove from the active set.

## Lazy run-tool wrappers (v1.4)

After loading via `vibehack_load_tools`, the planner can call any of these. Each wraps `pi.exec(<bin>, args, opts)`:

```js
vibehack_run_subfinder({args:["-d","example.com","-silent"], timeout_ms: 30000})
vibehack_run_nuclei({args:["-u","https://target","-t","cves/"]})
vibehack_run_sqlmap({args:["-u","https://t/?id=1","--batch","--level=2"]})
vibehack_run_ffuf({args:["-u","https://t/FUZZ","-w","wordlist.txt"]})
vibehack_run_httpx({args:["-l","subs.txt","-status-code","-tech-detect"]})
// 30+ more — browse via vibehack_tool_search({})
```

Returns `{exit_code, stdout, stderr, killed, tool}` on success or `{error:"not-installed", install_hint:"apt install <pkg>"}` if the binary isn't on PATH.

---

## Command order in normal flow

```text
1. /vibehack <target>                  ← bootstrap engagement
2. (you type natural-language)         ← planner drives the tree
3. /vibehack-tree                       ← progress check
4. /vibehack-pin <fact>                 ← pin discoveries
5. /vibehack-auto 10                    ← autonomous burst
6. (review; /steer if needed)           ← course-correct
7. /vibehack-chain-confirm              ← run staged chain
8. /vibehack-complete                   ← wrap up + final report
```

For longer engagements, swap step 8 for `/vibehack-pause` and re-enter at step 1 with the same target later — `/vibehack-resume` will pick up where you left off.
