# pi-vibehack vs other AI security harnesses

This page compares pi-vibehack to the closest public AI security-research harnesses we know about: **H-mmer / pentest-agents** (the 48-specialist Claude-Code style fleet), **XBOW** (commercial autonomous bug-bounty agent), and **pentagi** (containerized multi-agent pentest framework).

The goal is honest differentiation, not a competitive scorecard. Where competitors do something better, we say so. Where pi-vibehack has a structural advantage, we name the mechanism.

---

## Feature matrix

| Feature | pi-vibehack | H-mmer/pentest-agents | XBOW | pentagi |
|---|---|---|---|---|
| Hypothesis-tree REPL | ✅ | ❌ scan-first pipeline | ❌ coordinator+solvers | ❌ |
| On-the-fly tool synthesis | ✅ 4 ingest modes | ❌ static markdown agents | partial | ❌ |
| Subprocess context isolation | ✅ --no-session 3-role | partial (model: inherit) | ✅ isolated VMs | ✅ containers |
| Wire-layer recall injection | ✅ before_provider_request | ❌ | ❌ | ❌ |
| Skills-first methodology | ✅ | ✅ (48 specialists) | partial | ❌ |
| Live cost telemetry | ✅ (v1.0.1) | ✅ | unknown | partial |
| Browser-CDP verification | v1.1 | ❌ | ✅ | ❌ |
| Canary deterministic validation | v1.1 (file+HTTP) | ❌ | ✅ DNS+FS+DB | ❌ |
| Self-evolving loop | v1.1 (B+A) | ❌ | unknown | ❌ |
| Specialist count | 5 + ∞ via ingest | 48 | unknown | unknown |
| Tool count (with Kali discovery) | v1.1: ~80 + ∞ | preinstalled set | preinstalled | containerized Kali |
| Open source | ✅ MIT | ✅ MIT | ❌ commercial | ✅ |

Rows marked `v1.1` are roadmap items already specified — see [`docs/superpowers/specs/`](superpowers/specs/) for the v1.1 design.

---

## Why pi-vibehack over H-mmer / pentest-agents

H-mmer ships ~48 specialist agents as static markdown files — an impressive breadth-first methodology library, and one of the cleanest skills-first inspirations we drew from. Where pi-vibehack diverges is **shape**, not breadth: H-mmer is a scan-first pipeline that fans out specialists, while pi-vibehack is a hypothesis-tree REPL where every Planner turn must mutate the tree (hypothesis-or-die, hook-enforced) and every leaf carries a falsifier. The Planner cannot drift into vibes-only chat — drift becomes structural and visible.

pi-vibehack also adds **on-the-fly tool synthesis** via `/vibehack-ingest` (4 modes — scurl auth-flow, MCP server wrap, recipe SKILL.md, specialist SKILL.md), so the harness grows mid-engagement instead of being capped at the preinstalled specialist set. And the **wire-layer recall** (`before_provider_request` injecting graphify subgraphs every Planner turn) means engagement #2 against a similar target starts smarter than #1 finished — without the Planner ever calling a recall tool.

H-mmer wins on out-of-the-box specialist coverage today. pi-vibehack ships 5 specialists + unbounded growth via ingest, and treats specialist count as a runtime property, not a packaging decision.

## Why pi-vibehack over XBOW

XBOW is the strongest commercial point of comparison and is honestly ahead on several dimensions: **isolated VMs per engagement**, **browser-CDP verification**, and a full **canary deterministic-validation suite** (DNS + filesystem + DB). pi-vibehack's v1.1 roadmap adds browser-CDP and a file+HTTP canary subset, but XBOW's verification stack is more mature today.

What pi-vibehack offers that XBOW does not, structurally: the **hypothesis-tree REPL** with operator steering (XBOW is coordinator+solvers, autonomy-first), **open-source MIT** (auditable, forkable, runnable air-gapped), **on-the-fly tool synthesis** mid-engagement, and **wire-layer recall injection** at `before_provider_request`. The 3-role subprocess isolation (`pi --mode json -p --no-session` for Planner / Operator / Reporter) gives context separation without VM cost — different tradeoff, same goal.

If you need a hands-off SaaS bug-bounty agent, XBOW is the right tool. If you need an operator-steered, open, hackable harness that compounds across engagements, pi-vibehack is the right tool.

## Why pi-vibehack over pentagi

pentagi gives you containerized Kali in a multi-agent pentest framework — strong on tool availability and isolation, less opinionated on **methodology**. pi-vibehack is methodology-first: skills-first specialists, hypothesis-tree invariants, falsifier-required leaves, negative-space synthesis (missing CSP/HSTS/SPF become positive evidence events without the Planner asking).

pi-vibehack also has the **wire-layer recall** advantage (graphify-backed cross-engagement memory injected silently at `before_provider_request`) which pentagi does not implement. And `/vibehack-ingest` lets the harness grow new tools mid-engagement, complementing the preinstalled set rather than being bounded by it.

pentagi wins on container isolation and Kali tool breadth out-of-the-box. pi-vibehack's v1.1 Kali-discovery work narrows that gap (~80 tools + unbounded ingest), but pentagi's containerization story is more mature today.

---

## What we deliberately don't do

- **No fully autonomous mode** — the Planner is operator-steered by design. `/confirm` gates every Operator subprocess. We treat "operator-in-the-loop" as a feature, not a limitation.
- **No bundled vulnerability database** — recall is engagement-derived (graphify), not CVE-feed-derived. We trust the operator to bring CVE context via `/vibehack-ingest` when relevant.
- **No CI-style scan reports** — output is hypothesis-tree + findings.md, not a PDF dashboard. The artifacts are forensic (audit.log, events.jsonl, tree.md), not marketing.

---

## Provenance

References that informed the v1.0 design (verify before citing): Project Naptime / Big Sleep, PentestGPT (USENIX 2024), HackingBuddyGPT, CAI, Cybench, EnIGMA / SWE-agent, NYU CTF Bench, XBOW. Deep notes in [`docs/research/`](research/).
