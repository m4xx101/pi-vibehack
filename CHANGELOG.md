# Changelog

## v1.1.8 — 2026-05-03

### Fixed
- **`/vibehack <target>` actually starts the engagement now (real fix).** v1.1.6's auto-bootstrap-in-tool was a workaround: the LLM read "no active engagement" from the session banner and refused to call `vibehack_expand` at all, so the bootstrap path never fired. Real fix: registered a `pi.registerCommand?.("vibehack", ...)` handler that creates the engagement directory, writes the `.active` marker, and emits `engagement_start` BEFORE the LLM prompt body renders. The LLM now sees an active engagement when it's instructed to call `vibehack_expand(kind:"root", ...)`. Idempotent: re-running `/vibehack <same-target>` reuses the existing engagement.

## v1.1.7 — 2026-05-03

Production-hardening pass — no new features. Fixes from the v1.1.6 production audit (5 Important + 4 Minor).

### Fixed
- **`before-agent-start` and `tool-result` hooks now isolated with outer try/catch.** A runtime crash inside either hook used to break every subsequent Planner turn. Both now log via `ctx.ui.notify` and return a safe no-op shape on failure (defense-in-depth around the existing per-section try/catches).
- **`additionalProperties: false` on all 9 Planner tool schemas** (`expand`, `confirm`, `evidence`, `dead-end`, `prune`, `propose-chain` + inner step shape, `propose-specialist`, `recall`, `canary-verify`). Extras supplied by the LLM now fail validation loudly instead of being silently accepted.
- **`vibehack-chain-confirm` guards for active engagement before file I/O.** Aligns with the guard pattern used by `/steer` and other handlers.
- **`vibehack-handoff` no longer double-executes.** The prompt was running on the LLM (`restore: true`) at the same time the registered command handler did the actual file write — second pass overwrote the first. Prompt is now `restore: false` with a pointer to the handler.

### Refactor
- Hoisted `asString` defensive coercer to `extensions/pi-vibehack/lib/coerce.ts` for shared use (was a private helper inside `persona.ts`).
- Defensive `asString` coercion in `reflection.ts` (`leaf.surface`, `slugify` input) for JSONL-loaded data that may not be a string.
- Defensive `String()` coercion before `.trim()` on `vibehack_expand` `falsifier` param.
- `recall.ts` `execute` signature aligned with the project convention (5 args, last 3 underscore-prefixed when unused). Cosmetic.

## v1.1.6 — 2026-05-03

### Fixed
- **Extension crash on every prompt: `(modelId ?? "").toLowerCase is not a function`.** pi-mono passes the model as either a string id or an object (`{id, name, provider, ...}`); our `detectProvider` assumed string-or-undefined. Hardened to coerce any input via a `modelIdString()` helper that pulls `.id`/`.name`/`.model` from objects before lowercasing.
- **`vibehack_expand` always rejected with "no active engagement".** Pre-1.1.6, `/vibehack <target>` only rendered the LLM prompt — it never actually bootstrapped an engagement directory or wrote the `.active` marker. Calls to `vibehack_expand(parent_id:null, kind:"root", ...)` would error out forever. Fix: `vibehack_expand` now auto-bootstraps on its first root call (derives engagement id from `claim`, creates the dir, writes `.active`, emits `engagement_start`). The `/vibehack` slash command and the auto-bootstrap path now compose cleanly.

## v1.1.5 — 2026-05-03

### Added
- **`pi-vibehack update`** subcommand — pulls the latest `@m4xx101/vibeshack` from npm, re-runs install (idempotent). Preserves `config.yaml`, hand-edited prompt frontmatter, and engagement data. Re-execs the freshly-installed binary so the new version's install logic runs (not the stale loaded version).
- **`/vibehack-update`** slash command — same operation from inside pi.
- **`pi-vibehack --version` / `-v`** — prints package version.

## v1.1.4 — 2026-05-03

### Fixed
- **Skill conflicts at pi boot.** pi-mono enforces that a `SKILL.md`'s `name:` frontmatter must match its parent directory. Renamed all 14 shipped skill names to match: `curl-recipes` → `curl`, `auth-bypass-specialist` → `auth-bypass`, etc. (9 recipes + 5 specialists). No behavioral change; only frontmatter `name:` field renamed.
- `install.sh` guards against deleted cwd (`getcwd: ENOENT`) by `cd $HOME` at startup.

## v1.1.3 — 2026-05-03

### Fixed
- **Extension load failure: `Cannot read properties of undefined (reading 'Has')`.** Root cause: pi-mono aliases `@sinclair/typebox` imports to its bundled `typebox` 1.x package (a different library). `FormatRegistry` doesn't exist there. Replaced `FormatRegistry.Set("date-time", ...)` with `Type.String({ pattern: ISO_8601_PATTERN })`, which is portable across both libraries. Strict ISO 8601 validation behavior is preserved.

## v1.1.2 — 2026-05-03

### Fixed
- **pi boot crash on missing pi-dcp postinstall (root-cause fix).** pi-mono's `installedNpmMatchesPinnedVersion` does string equality between settings.json's spec version and the installed package version. Pinning a semver range (`^0.1.0`) never equals the resolved version (`0.1.3`), so pi-mono re-ran `npm install -g @zenobius/pi-dcp@^0.1.0` on every boot, re-triggering the broken `@stacksjs/clarity` `bunx git-hooks` postinstall. v1.1.2 resolves the exact installed version after preflight and pins it in settings (`npm:@zenobius/pi-dcp@0.1.3`). pi-mono's equality check now succeeds, lazy install is skipped entirely, postinstall never fires.

## v1.1.0 — 2026-05-03

### Install UX
- Always preflight-install `@zenobius/pi-dcp@^0.1.0 --ignore-scripts` (bypassing the broken `bunx git-hooks` upstream postinstall) BEFORE registering it in `settings.json`. pi-mono's lazy install at boot finds it cached and never crashes. No user flag, no opt-in. Just works.
- `install.sh` now ships a polished UX: ASCII π banner, 5-step indicator, colored status lines, WSL PATH-shadowing detection, detect-and-retry on transitive postinstall failures.
- `bin/install.js` accepts `--with-dcp` flag, executable bit set on all `bin/*.js`.
- `@sinclair/typebox` moved from devDependencies → dependencies (extension runtime needs `FormatRegistry`).
- `npm install -g @m4xx101/vibeshack` (no tag) now Just Works — single `latest` dist-tag.

## v1.1.0-rc1 — 2026-05-02 *(superseded by v1.1.0)*

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
