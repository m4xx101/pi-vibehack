# pi-vibehack — FAQ

## What is pi-vibehack?

A context-aware vibe-hacking harness for [pi-mono](https://github.com/badlogic/pi-mono). It turns pi into a security-research engine: hypothesis-tree REPL, three-role subprocess isolation, graphify-backed wire-layer recall, on-the-fly tool synthesis. Bug bounty / pentest / CTF / red team.

## What's the difference between pi-vibehack and fenrir-harness?

fenrir-harness is for [Hermes Agent](https://hermes-agent.nousresearch.com/). pi-vibehack is for pi-mono. Architecturally they share the philosophy (hypothesis-driven, reproducibility-gated, audit-logged) but pi-vibehack is much leaner:

- 3 roles vs fenrir's 16 specialist subagents
- 5 specialist *skills* vs 16 specialist *agents* — same flexibility, ~zero structural complexity
- 1 extension wiring 6 hooks vs fenrir's 5 hook scripts + dispatch profiles
- graphify recall + `before_provider_request` injection vs fenrir's SQLite wiki
- No separate dispatch layer — `pi-prompt-template-model` frontmatter handles per-command model+thinking+skill

If you want the long answer, read [ADR-0009](adr/0009-specialists-as-skills-not-subagents.md) and the [design spec §1](superpowers/specs/2026-04-29-pi-vibehack-design.md).

## Why is graphify a soft dep and not bundled?

graphify is a separate tool with its own install path and dependencies. Bundling it would couple pi-vibehack's release cycle to graphify's. Soft dependency lets each evolve independently. Without graphify, the recall layer falls back to `grep`-over-events.jsonl — still works, just less smart.

## How does the agent know which specialist to use?

It doesn't, automatically. The Planner emits `vibehack_propose_specialist(node_id, kind)` based on its read of the tree (a leaf about JBoss → propose `web-exploit`; a binary CTF challenge → propose `binary-recon`). The pinned specialist is loaded into the next Operator subprocess that runs that leaf's `next_test`.

If the Planner picks badly, the operator can override by editing the next_test or pruning the leaf and re-expanding with a different specialist hint.

## Can I run multiple engagements in parallel?

Not in a single pi session — only one engagement is "active" at a time (marker file `~/.pi/agent/vibehack/.active`). But you can run multiple pi sessions concurrently in different terminals, each with a different active engagement. Engagement data is on disk under `engagements/<id>/`, so there's no in-memory state collision.

## What happens if I `Ctrl+C` mid-Operator-subprocess?

You kill the entire pi session, not just the subprocess. The subprocess inherits the kill signal and dies. Any partial evidence files it wrote to disk remain (they're operator-supplied, not transactional). The Planner won't see a return value, so the leaf stays in `in-flight` state.

Recovery: re-run `/confirm <node_id>` or mark `vibehack_dead_end` and pivot.

## Does the harness auto-confirm exploit chains?

No. `vibehack_propose_chain` writes a `chain_propose` event but does not execute. The operator must explicitly run `/vibehack-chain-confirm` (or `--interactive` for step-by-step). Per [ADR-0007](adr/0007-unleashed-scope.md) and Goal 6 of the spec, destructive chain steps are operator-gated.

## How do I share an engagement with a teammate?

Engagements are git-friendly. Either:

```bash
cd ~/.pi/agent/vibehack/engagements/<id>
git init && git add -A && git commit -m "engagement so far"
git push <remote> main
```

Or just zip the directory. Everything you need (events.jsonl, tree.md, findings.md, poc/, audit.log, AGENTS.md) is in `<id>/`.

For team workflows where multiple operators write to the same engagement: append-only JSONL means you can `git pull && git rebase` without conflicts on events.jsonl most of the time. Real concurrent edit handling isn't a v1.0 feature — single-operator only.

## Why does `/steer` only inject on the next turn, not immediately?

Pi's lifecycle: the operator types `/steer <text>` mid-turn. The current LLM call is already in flight or just completed. Injecting now would race. Instead, `/steer` writes to `<engagement>/.pending-steer`, and the next `before_agent_start` consumes + injects it.

Effect: after `/steer focus on jenkins`, the next Planner turn sees an `<operator_steer>` block and reprioritizes.

## Can I rewrite events.jsonl by hand?

Technically yes, but the schema is strict (typebox validates every append). Bare-hand editing risks producing lines `appendEvent` would reject. If you must:

1. Stop pi.
2. Edit events.jsonl.
3. Run `npx vitest run -t "events-schema"` to validate the file shape.
4. Restart pi.

Better: re-engagement. Lessons.jsonl will catch the cross-engagement signal.

## What happens if my data dir fills up?

`~/.pi/agent/vibehack/` grows unboundedly across engagements. Per engagement: events.jsonl + evidence files + per-leaf PoCs + audit.log + graph artifacts. Could hit hundreds of MB on a long-running engagement.

Manual housekeeping: `rm -rf engagements/<old-id>` when archived elsewhere. Lessons.jsonl and graph/ retain the cross-engagement learning.

The harness has no built-in cleanup. v1.0.1 may add `/vibehack-archive <id>`.

## How does the harness handle re-engagement against the same target?

Smart by design. The global graph at `~/.pi/agent/vibehack/graph/` aggregates findings across all engagements. The first turn's `before_provider_request` injects relevant subgraphs, including ones from prior engagements with the same target.

Concretely: engagement #2 against `acme.example` starts with the Planner already knowing about JBoss vulnerabilities you confirmed in engagement #1.

## Can I use a local model only?

Yes. `--profile local` at install:

```bash
curl -fsSL https://raw.githubusercontent.com/m4xx101/pi-vibehack/main/install.sh | bash -s -- --profile local
```

This pins all three roles (Planner/Operator/Reporter) to `qwen-72b-instruct` by default. Override per role:

```bash
curl -fsSL .../install.sh | bash -s -- --profile local \
  --planner llama-3.3-70b --operator qwen-72b --reporter mistral-large
```

Or after a fresh install, edit `~/.pi/agent/vibehack/config.yaml` directly and run `/vibehack-config sync` to regenerate prompt frontmatter.

Custom local providers (LM Studio, Ollama, vLLM) need to be registered with pi via `pi.registerProvider` — see [`docs/EXTENDING.md`](EXTENDING.md#adding-a-custom-llm-provider).

For sensitive engagements (where target output should never reach a frontier provider), local-only is the right choice.

## Is the cost ever blocking?

No. Per [ADR-0007](adr/0007-unleashed-scope.md), unleashed scope means cost is **tallied** but **never gates**. Status banner shows running total. `/vibehack-cost` for breakdown by tool.

If you want a hard cap, you'd add it in your own hook — not v1.0.

## How do I prove an engagement was authorized?

The harness audit-logs every tool call to `<engagement>/audit.log`. That's your forensic record. Pair it with:

- Your authorization document (signed scope letter, bug bounty platform invite, etc).
- The events.jsonl (who started the engagement when, against what target).
- The final report (which targets were probed, how, with what evidence).

Pi-vibehack does not enforce scope. **You** are the authorization layer. See [SECURITY.md](SECURITY.md).

## What's the worst-case prompt-injection scenario?

A malicious target page returns content that, when read by an Operator subprocess, manipulates the LLM into:

1. Reaching out-of-scope.
2. Exfiltrating the operator's local files via the LLM's tool calls.
3. Modifying the events.jsonl to hide its tracks.

Mitigations:

- **Subprocess isolation** ([ADR-0006](adr/0006-subprocess-isolation-for-untrusted-output.md)): Operator runs `--no-session` so target output can't poison the persistent Planner reasoning chain.
- **Structured-JSON return**: only schema-validated fields reach the Planner. Free-text manipulation is bounded.
- **Audit log**: every tool call is logged. Forensic recovery possible.
- **Operator review**: the human-in-the-loop is the final check, especially for `/confirm` and `/vibehack-chain-confirm`.

Residual risk: an Operator subprocess can still execute bash commands the target tricked it into. The audit log records this; the harness's untrusted output never reaches Planner. But the *machine running* the Operator is at risk if the LLM is sufficiently jailbroken.

For maximum safety: run pi-vibehack in a sandboxed VM or container, especially for unknown / hostile targets.

## Why doesn't `/confirm` block until the per-leaf reporter finishes?

The reporter runs fire-and-forget. Operator subprocess returns, tool_result hook spawns the per-leaf reporter, and the Planner's next turn is unblocked. The reporter writes `poc/<node_id>/poc.md` whenever it's done.

If the reporter is slow, the operator can keep working. If it fails, the failure is logged to audit.log; the operator can re-run a manual reporter via `/vibehack-complete` (which spawns the final reporter that re-reads everything).

## What's the v1.0.0 vs v1.0.0-rc1 distinction?

v1.0.0-rc1 is what's tagged at HEAD. It's feature-complete (122/122 tests, every spec §6.5 acceptance criterion landed). The "rc1" suffix says "release candidate" — pending real-target dogfooding.

After dogfooding surfaces no real-world issues, retag as v1.0.0 and `npm publish`.

## Who built this?

m4xx101. The harness is opinionated — it reflects what works in practice for vibe-hacking, not theoretical purity.

Built on top of:

- [pi-mono](https://github.com/badlogic/pi-mono) by Mario Zechner — the runtime
- [pi-prompt-template-model](https://github.com/nicobailon/pi-prompt-template-model) by nicobailon — dispatch
- [pi-dcp](https://github.com/zenobi-us/pi-dcp) by zenobi-us — context budget
- [pi-super-curl](https://github.com/Graffioh/pi-super-curl) by Graffioh — HTTP/auth surface (soft)
- [surf-cli](https://github.com/nicobailon/surf-cli) by nicobailon — Chrome control (soft)
- [graphify](https://github.com/m4xx101/graphify) — recall substrate (soft)
- Inspirations from [hjanuschka/shitty-extensions](https://github.com/hjanuschka/shitty-extensions) (memory-mode, handoff) and [tmustier/pi-extensions](https://github.com/tmustier/pi-extensions) (agent-guidance)

SOTA references that shaped the design: Project Naptime / Big Sleep, Cybench, EnIGMA / SWE-agent, XBOW, PentestGPT, HackingBuddyGPT, CAI. See [`docs/research/`](research/) for the deep notes.

## How do I report a bug or contribute?

[GitHub issues / PRs](https://github.com/m4xx101/pi-vibehack). For security issues in pi-vibehack itself (not in target systems), see [SECURITY.md](SECURITY.md).

Contributing: read [CONTRIBUTING.md](CONTRIBUTING.md) and [EXTENDING.md](EXTENDING.md). Major architectural changes need a new ADR.

## Where do I learn more?

| Doc | Purpose |
|---|---|
| [README](../README.md) | Front door |
| [QUICKSTART](QUICKSTART.md) | 5-minute first engagement |
| [INSTALL](INSTALL.md) | Install reference |
| [OPERATOR-GUIDE](OPERATOR-GUIDE.md) | Daily-use manual |
| [COMMANDS](COMMANDS.md) | Slash command reference |
| [ARCHITECTURE](ARCHITECTURE.md) | Design + diagrams |
| [RECIPES](RECIPES.md) | Bundled tools and specialists |
| [EXTENDING](EXTENDING.md) | Add your own |
| [TROUBLESHOOTING](TROUBLESHOOTING.md) | Symptom → fix |
| [SECURITY](SECURITY.md) | Authorization + responsible-use |
| [ADRs](adr/) | Architectural decision records |
| [Spec](superpowers/specs/2026-04-29-pi-vibehack-design.md) | Locked design |
| [Plan](superpowers/plans/2026-04-29-pi-vibehack.md) | Executable plan |
