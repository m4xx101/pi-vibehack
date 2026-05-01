# pi-vibehack

> Context-aware vibe-hacking harness on [pi-mono](https://github.com/badlogic/pi-mono). Hypothesis-tree REPL, graphify-backed recall, on-the-fly tool synthesis. Bug bounty / pentest / CTF / red team / research.

> ⚠️ **Authorized testing only.** The operator is responsible for authorization. Do not use against systems you do not own or have explicit, written permission to test.

## What it is

A pi-mono extension that turns pi into a security research engine:

- **Hypothesis-tree REPL.** Operator steers a live tree spanning recon → enum → exploit → post-ex → lateral → report. Every node has a falsifier; depth/breadth bounds prevent rabbit-holes.
- **Three-role subprocess isolation.** Planner reasons; Operator executes (`pi --mode json -p --no-session`); Reporter writes. Target output never poisons the Planner's reasoning chain.
- **Live knowledge graph.** Every confirmed leaf folds into a `graphify` graph. The `before_provider_request` hook auto-injects relevant subgraphs into every Planner turn — the agent feels telepathic about prior engagements.
- **Six recipe skills + on-the-fly tool synthesis.** Bundles curl/super-curl, httpx, nuclei, ffuf, searchsploit, nmap. `/vibehack-ingest` extends in four modes: existing CLI, git repo, name+description (writes the tool from scratch), inline spec.
- **Five specialist skills.** web-recon, web-exploit, binary-recon, auth-bypass, osint. Add more via `/vibehack-ingest --specialist <kind>`.
- **Browser automation when needed.** surf-cli + playwright-cli recipes auto-load on `requires_browser: true` leaves.
- **Auth round-trip.** When Operator hits an auth wall, it returns `blocked-on-auth` with a scurl template request; you paste the captured token into the TUI; subprocess respawns. No public harness handles this without breaking flow.

## Install

```bash
npx -y @m4xx101/pi-vibehack install
```

See [INSTALL.md](docs/INSTALL.md) for profiles, troubleshooting, project-scoped installs.

## Quickstart

```
/vibehack acme.example                  # start engagement
/vibehack-tree                          # open fullscreen tree viewer
/steer focus the GraphQL endpoint       # vibe-hack — redirect mid-flight
/confirm n_3b                           # confirm a leaf vulnerable
/vibehack-ingest "subdomain takeover detector"  # synthesize a new tool
/vibehack-complete                      # final report + wiki promotion
```

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) and the locked design spec at [`docs/superpowers/specs/2026-04-29-pi-vibehack-design.md`](docs/superpowers/specs/2026-04-29-pi-vibehack-design.md).

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

Built on top of [pi-mono](https://github.com/badlogic/pi-mono) by [Mario Zechner](https://github.com/badlogic). Composes:
- [`@nicobailon/pi-prompt-template-model`](https://github.com/nicobailon/pi-prompt-template-model) — frontmatter-driven dispatch
- [`pi-dcp`](https://github.com/zenobi-us/pi-dcp) — Dynamic Context Pruning
- [`pi-super-curl`](https://github.com/Graffioh/pi-super-curl) — HTTP/auth surface (soft)
- [`surf-cli`](https://github.com/nicobailon/surf-cli) — Chrome control (soft)

Inspired by Project Naptime / Big Sleep, Cybench, EnIGMA / SWE-agent, fenrir-harness.
