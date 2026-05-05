# Changelog

## v1.3.0 — 2026-05-05

CyberStrike-inspired bug-bounty pass. Studied [CyberStrike](https://github.com/CyberStrikeus/CyberStrike) — an open-source AI red-team agent — and pulled in its highest-leverage patterns for autonomous bug-bounty work, while keeping pi-vibehack's hypothesis-tree REPL semantics intact.

### Phase A — Specialist persona registry
- New `lib/persona-registry.ts` ships **12 domain personas**: `general`, `web-application`, `mobile-application`, `cloud-security`, `internal-network`, plus 7 vuln-class lenses (`idor`, `auth-bypass`, `mass-assignment`, `injection`, `business-logic`, `ssrf`, `file-attacks`). Each persona carries a short methodology body — OWASP WSTG sections for web, MASTG for mobile, CIS benchmarks for cloud, ATT&CK Lateral Movement for AD, etc.
- Active persona is per-engagement state at `engagements/<id>/.active-persona`. The `before-agent-start` hook prepends the active persona's body to the system prompt, biasing tool selection toward the domain.
- `/persona <name>` slash command: `list` shows the catalogue; `<name>` switches.
- `vibehack_use_persona` tool lets the Planner self-switch when crossing surface boundaries (e.g. discovers IMDS → switches to `ssrf`; finds JWT → switches to `auth-bypass`).
- New typed `persona_switch` event so persona changes appear in the tree timeline + are mirrored to the pi session JSONL via the v1.2 appendEntry pipe.

### Phase B — Structured vulnerability reporting (`vibehack_report_vuln`)
- New tool emits a HackerOne-format markdown report at `engagements/<id>/vulns/<node_id>.md` and a typed `vuln_reported` event with `{title, severity, cvss?, affected_url, impact, reproduction_steps, evidence_paths, owasp?, cwe?}`.
- Severity is the standard 5-step scale (`info` / `low` / `medium` / `high` / `critical`) with optional CVSS 3.1 (0.0–10.0).
- Markdown layout follows the de-facto HackerOne / Bugcrowd structure: Summary → Severity → Affected URL → Impact → Steps to Reproduce → Evidence → References (OWASP / CWE).
- `prepareArguments` shim accepts common drift (`url`/`affectedUrl` → `affected_url`, `steps`/`repro` → `reproduction_steps`, `evidence` → `evidence_paths`, `cvssScore` → `cvss`).

### Phase C — Bug-bounty tool catalogue + on-demand search
- New `data/tool-catalog.ts` ships **30+ canonical bug-bounty tools** across recon, web fuzzing, vuln scanners, cloud, mobile, AD/network, and generic (subfinder, amass, httpx, naabu, nmap, masscan, ffuf, gobuster, feroxbuster, katana, waybackurls, gau, nuclei, nikto, wpscan, sqlmap, dalfox, prowler, scout, pacu, cloudbrute, frida, objection, apktool, jadx, nxc, impacket-secretsdump, bloodhound-python, responder, hydra, curl, jq).
- New `lib/tool-detector.ts` resolves PATH presence via `which`/`where` (cross-platform — Kali, WSL, mac, Windows) at `session_start`. Cache-warmed so first call is instant.
- New `vibehack_tool_search` tool — CyberStrike's lazy-registry pattern: instead of bloating context with 30 tool descriptions, the Planner asks for what it needs (`{query: "subdomain", domain: "recon"}`) and gets the top matches with installed-flag + install-hint.
- `/vibehack-tools [query]` slash command for operator browsing.
- Each catalogue entry: `{name, bin, domain[], capabilities[], description, example, install}`.

### Phase D — Autonomous mode (`/vibehack-auto`)
- `/vibehack-auto [depth]` injects an `<auto_mode>` steer that biases the Planner toward depth-first hypothesis advancement: always advance the tree, commit after 3 evidence rounds, immediately call `vibehack_report_vuln` on confirmed exploitable findings, persona-switch on surface boundaries, prefer installed tools via `vibehack_tool_search`, halt only when all open nodes are confirmed/dead-ended or operator intervenes.
- No new dependency on a chain-runner subprocess — uses pi-mono's existing turn cadence, just steers the planner's behaviour.

### Tools added
- `vibehack_use_persona`
- `vibehack_report_vuln`
- `vibehack_tool_search`

### Slash commands added
- `/persona [list | <name>]`
- `/vibehack-tools [query]`
- `/vibehack-auto [depth]`

### Schema additions (events)
- `persona_switch` — `{name, rationale?}`
- `vuln_reported` — full HackerOne-format payload

### Tests
- 305 → 318 (+13). Persona registry round-trip, alias normalization, vuln-report markdown shape + alias drift, tool-search ranking + domain filter + installed_only filter.

### Why these picks (vs CyberStrike's full surface)
- ✅ **Persona switching:** CyberStrike's biggest UX/methodology win — let one model wear different specialist hats.
- ✅ **Structured vuln reports:** turns engagement output into shippable bounty submissions.
- ✅ **Tool catalogue + lazy search:** keeps context lean; biases the Planner to use real bug-bounty tools, not improvised curl one-liners.
- ❌ **Bolt remote tool execution:** out of scope — pi-vibehack runs in pi-mono's process; the operator can run remote tools via `pi.exec` + SSH already.
- ❌ **MCP server orchestration:** pi-mono already speaks MCP; we don't need a parallel router.
- ❌ **Web UI / Cloudflare tunnel:** different product surface; pi's TUI is the contract.

## v1.2.0 — 2026-05-05

Major rewire pass: pi-vibehack now uses pi-mono APIs the way pi-mono actually exposes them, instead of reimplementing them. Every claim was fact-checked against pi-mono source (`@mariozechner/pi-coding-agent` `dist/core/extensions/types.d.ts` + `dist/core/resource-loader.js` + `dist/core/extensions/loader.js`). Plan: `docs/superpowers/specs/2026-05-04-pi-vibehack-v1.2-rewire-plan.md` (internal).

### Phase 1 — `prepareArguments` shims + type-safety
- Every Planner tool now declares `prepareArguments` (pi-mono `types.d.ts:344`, `tool-definition-wrapper.js:8`). LLM hallucinations like `nodeId`→`node_id`, `parentId`→`parent_id`, `vulnClass`→`kind` are rewritten *before* TypeBox validation rejects them. Defensive: any shim throw falls through to the original args.
- Replaced `(event: any, ctx: any)` across 6 hooks with the real typed signatures from `@mariozechner/pi-coding-agent` (new `lib/typed-pi.ts` re-exports `ExtensionAPI`, `ToolCallEvent`, `BeforeAgentStartEvent`, etc.).
- Surfaced and fixed several latent bugs that were hidden by `: any`: `ctx.ui.notify(..., "warn")` is invalid (`"warning"` is the right level); `session_before_compact` should return `{compaction}` not `{customSummary}`.

### Phase 2 — Native AGENTS.md / SYSTEM.md adoption
- pi-mono natively walks cwd for `AGENTS.md`/`CLAUDE.md` (`resource-loader.js:31`) and loads `~/.pi/agent/SYSTEM.md` + `APPEND_SYSTEM.md` (`resource-loader.js:662, 666, 673, 677`). The before-agent-start hook used to re-read those files and stuff them into the system prompt — pure duplication.
- Now skipped by default. Set `vibehack.agentsMdCompat: true` in `~/.pi/agent/vibehack/config.yaml` to keep the dual-load behaviour for one minor version (Risk #2 mitigation).
- New `hooks/resources-discover.ts` returns `{skillPaths, promptPaths}` for the `resources_discover` event so vibehack skills/prompts surface via the documented channel instead of DCP/global-md tricks.

### Phase 3 — `pi.appendEntry` mirroring + message renderers
- Every `appendEvent` now also calls `pi.appendEntry("vibehack/<event>", payload)` (pi-mono `types.d.ts:845`, runner.js binding) so vibehack moves land in pi's session JSONL — visible to `/resume`, the tree viewer, and any extension hooking `tool_result`. The engagement-scoped `events.jsonl` remains canonical; the pi side is a best-effort mirror that swallows pi-side errors.
- Registered `pi.registerMessageRenderer("vibehack/<kind>", ...)` for every event family so the TUI shows distinctive lines for expand/prune/confirm/etc.

### Phase 4 — `ctx.ui.confirm` gates on destructive tools
- `vibehack_canary_verify` now gates the canary plant behind `ctx.ui.confirm` when `ctx.hasUI` is true. Print/RPC mode (`hasUI=false`) bypasses the prompt to preserve scripted behaviour. 60s timeout per Risk #4; timeout treated as decline. Returns `{ error: "user-blocked" }` so the planner can fall back.

### Phase 5 — Treat `ExtensionAPI` as the contract it is
- Dropped every `pi.registerCommand?.(...)` (`?.` removed from `register*` calls — these are first-class APIs, not optional).
- Replaced the `(globalThis as any).__vibehack_dcp_rules = ...` cross-extension channel with `pi.events.emit("vibehack/dcp-rules", ALL_DCP_RULES)`. Named export `vibehackDcpRules` retained for backward compat.

### Phase 6 — CDP browser verifier (no Patchright dep)
- New `vibehack_browser_verify` tool attaches to an operator-run Chrome at `--remote-debugging-port=9222` (configurable host/port). Navigates to a URL, optionally evaluates a JS expression, returns the result + base64 PNG screenshot.
- Zero new deps: a tiny CDP client (~200 LoC over `node:net` + `node:http` with RFC 6455 framing) lives in `lib/cdp-client.ts`.
- Friendly error when no Chrome is attached: `{ error: "no-chrome-attached", hint: "start Chrome with --remote-debugging-port=…" }` — never throws.

### Phase 7 — Session legibility
- `pi.setSessionName("vibehack: <target>")` after engagement bootstrap so `/resume` shows the engagement target instead of a cwd-encoded path.

### Tests
- 264 → 305 tests (+41 across 9 prepareArguments suites + AGENTS.md compat + dcp-events + appendEntry mirror + canary confirm gate + browser-verify graceful failure + engagement naming).
- All passing on Windows + WSL.

### Migration notes
- If you maintain a fork that depended on `globalThis.__vibehack_dcp_rules`, switch to `pi.events.on("vibehack/dcp-rules", handler)` or read the named export.
- If you relied on `before-agent-start` reading per-engagement `AGENTS.md`, either drop your AGENTS.md into the engagement cwd (pi-mono picks it up natively) or set `vibehack.agentsMdCompat: true` for one minor version.
- The new `vibehack_browser_verify` tool is opt-in: it's listed in `PLANNER_TOOL_NAMES` but only fires when the planner asks for it. With no Chrome attached, it returns a friendly error.

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
