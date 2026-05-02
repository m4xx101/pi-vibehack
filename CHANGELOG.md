# Changelog

## v1.1.0-rc1 — 2026-05-02

### Added

**Self-evolving harness:**
- Layer B reflection loop (`extensions/pi-vibehack/lib/reflection.ts`) — clusters confirmed leaves by stack signature; writes refined recipes to `~/.pi/agent/vibehack/skills/learned/<slug>/SKILL.md`. Triggers: `session_before_compact`, `/vibehack-complete`, manual `/vibehack-reflect`. Operator-edited recipes protected from clobber.
- Layer A bench-driven mutation: `/vibehack-evolve --bench <name>` runs `bench/<name>/up.sh` → engagement → evaluate against `expected-findings.yaml` → `down.sh` → results report. `--mutate` flag spawns `vibehack-mutator` subagent in git worktree, lands mutation only if target bench passes AND regression suite stays green.

**Kali tool auto-discovery:**
- `KALI_TOOLS` catalog: 76 tools across 8 categories (recon/exploit/crack/forensic/network/web_api/mobile/misc).
- `detectKaliCapabilities()` runs at `session_start`, caches to `~/.pi/agent/vibehack/.capabilities.json`.
- Manual refresh: `/vibehack-rescan-kali`.
- Kali-MCP soft companion (`mcp-kali-server` / `zebbern-kali-mcp`) detected with banner.

**Auto-leverage existing pi extensions:**
- Extension detector scans `~/.pi/agent/extensions/`, `<cwd>/.pi/extensions/`, `~/.pi/agent/skills/`.
- 5 integrations auto-activate when corresponding extension present: `pi-mcp-adapter`, `memory-mode`, `handoff`, `pi-rewind-hook`, `pi-side-chat`.
- Operator's `~/.pi/agent/skills/<dir>/SKILL.md` files surface as `recipe_hints` in `<recall>` block.
- Soft commands `/vibehack-rewind` (needs pi-rewind-hook) and `/vibehack-fork` (needs pi-side-chat).

**Browser-CDP verifier:**
- `skills/specialists/browser-verifier/SKILL.md` — verifies browser-class confirms via headless Chrome (surf-cli → playwright → CDP fallback chain). Captures screenshot + DOM + console + network.
- `<verification_advisory>` block injected at `before_agent_start` between `<bounds_advisory>` and `<recall>` when browser-class confirms lack prior verification (DOM-XSS, reflected-XSS, stored-XSS, open-redirect, clickjacking, postMessage-leak, subdomain-takeover).
- `tool_result` hook validates screenshot artifact (exists + non-zero size) before emitting `verification_pass`; downgrades to `verification_advisory` on missing/empty.

**Canary primitives:**
- `extensions/pi-vibehack/lib/canary.ts` — `plantFileCanary` / `plantHttpCallbackCanary` / `verifyCanary` / `cleanupCanaries`.
- `vibehack_canary_verify(node_id, kind)` Planner tool — 6 kinds: RCE/AFR (filesystem), SSRF/open-redirect (HTTP callback), DNS/blind-OOB (operator-pinned collector subdomain).
- HTTP listener uses ephemeral port (`:0`); cleanup runs at `/vibehack-complete`.

**Schema additions:**
- 4 new event types in `event-schema.ts`: `verification_pass`, `verification_fail`, `verification_advisory`, `canary_planted`. All use Phase 5 envelope (`event:` discriminator + `engagement_id`). All `additionalProperties: false`. Backward-compatible with v1.0.0-rc1 events.jsonl.

### Changed
- `before-agent-start.ts` system-prompt assembly inserts `<verification_advisory>` after `<bounds_advisory>`.
- `before-provider-request.ts` `<recall>` block now includes operator skill `recipe_hints` when detected.
- `tool_result.ts` recognizes browser-verifier specialist returns and validates screenshot before emitting verification_pass.

### Test count
- v1.0.0-rc1 baseline: 123
- v1.0.1: +21 (Phase 1-3) → 155 → +0 (Phase 4 docs) → 155
- v1.1: +18 (Phase 5 schema) +14 (Phase 6 reflection) +13 (Phase 7 bench/evaluator) +8 (Phase 8 mutation) +10 (Phase 9 Kali) +11 (Phase 10 extensions) +13 (Phase 11 browser-verifier) +18 (Phase 12 canary) → 260+
- v1.1.0-rc1: **262/262 across 38 test files**

### Known follow-ups
- `defaultConfig` drift-test between `bin/lib/config.js` and `extensions/pi-vibehack/lib/config-runtime.ts`
- Lazy-install wiring from parent session pre-spawn (operator-spawn integration)
- Replace `shell:true` in graphify --version probe with execFile argv
- Phase 3 status-banner dual-field shim cleanup (now redundant after Phase 5 envelope alignment)
- Real `runMutator` subagent spawn wiring (Phase 8 deferred to dogfood; `operator-spawn.ts` is the model)
- Lazy Kali recipe generation when planner picks unknown tool (Phase 9 deferred; `lookupTool` helper ready)
- Tool-name detection heuristic in `tool-result.ts` for browser-verifier (Phase 11 acknowledged; tighten when specialist invocation pattern lands)
- Cleanup canaries on /vibehack-complete is currently best-effort; consider dedicated bin/vibehack-cleanup-canaries.js
- Lazy-install wiring from parent session pre-spawn (operator-spawn integration) — Phase 2 deferred
- Replace `shell:true` in graphify --version probe in session-start.ts:180 with execFile argv form
- Tighten browser-verifier tool-name detection heuristic in tool-result.ts:204-227 once specialist invocation pattern stabilizes
- Cleanup canaries on `/vibehack-complete` is currently best-effort `node -e` invocation; consider a dedicated `bin/vibehack-cleanup-canaries.js` for robustness

---

## [1.0.0] — TBD

### Added
- Hypothesis-tree REPL with eight Planner mutation tools.
- Three-role subprocess isolation (Planner / Operator / Reporter).
- Six lifecycle hooks (`session_start`, `before_agent_start`, `tool_call`, `tool_result`, `before_provider_request`, `session_before_compact`).
- Four pi-dcp rules for working-context budget.
- graphify-backed `vibehack_recall` + wire-layer `<recall>` auto-injection.
- Negative-space synthesis (missing CSP/HSTS/SameSite/etc + filtered-port detection).
- Auto-handoff at subprocess boundaries.
- Nine recipe skills (curl/super-curl/httpx/nuclei/ffuf/searchsploit/nmap/surf-cli/playwright-cli).
- Five specialist skills (web-recon, web-exploit, binary-recon, auth-bypass, osint).
- 17 frontmatter slash commands (15 core + 2 soft-companion).
- Tool-ingest in four modes (CLI / repo / synthesis / inline).
- Operator-gated chain mode (`/vibehack-chain-confirm`).
- Three pi-super-curl templates (auth-bearer-probe, jwt-tamper, csrf-replay).
- Browser automation via surf-cli + playwright-cli fallback.
- pi-prompt-template-model dispatch (per-command model + thinking + skill).
- Three install profiles (hybrid, local, frontier) + per-role overrides.
- Cross-session memory: `lessons.jsonl` + global graphify graph.
