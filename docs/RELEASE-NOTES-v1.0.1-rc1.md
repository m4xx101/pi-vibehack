# pi-vibehack v1.0.1-rc1 — Release Notes

**Tag:** `v1.0.1-rc1` (local-only; push gated by operator dogfood)
**Branch:** `v1.1-dev`
**Tests:** 155/155 across 26 vitest suites (was 123 baseline at v1.0.0-rc1 — net +32)
**Commits since main:** 20 on `v1.1-dev` (Phase 1: 11, Phase 2: 6, Phase 3: 2, Phase 4 docs: 1)

---

## What shipped

Three operator-facing features land in v1.0.1, all additive and non-breaking against v1.0.0-rc1.

### 1. User-configurable models via `~/.pi/agent/vibehack/config.yaml`

`bin/install.js` accepts `--planner / --operator / --reporter` flags and writes role assignments to `~/.pi/agent/vibehack/config.yaml`. The runtime reads this config at `session_start` and `before_agent_start` so prompt frontmatter, provider registration, and operator/reporter spawn calls all honor the operator's choice without manual edits.

- `/vibehack-config sync` regenerates prompt frontmatter from the live config (absolute-path bin script — no CWD assumptions).
- Hand-edited prompt frontmatter is preserved on subsequent install runs (no clobber).
- Custom providers declared under `providers.<name>` are registered with pi at `session_start` via `register-providers.ts`.
- `migrateConfig` deep-merges nested defaults, so partially-edited configs survive harness upgrades.

### 2. Soft-dep auto-install with consent

A new `lib/softdeps/` detector probes `pi-super-curl`, `surf-cli`, and `graphify` at `session_start` and shows a single batched consent prompt for any missing companions. Decline routes the harness to documented fallback chains (recipes are tagged with their fallback path). `auto_install.enabled: false` opts out and restores the v1.0 banner-only behaviour.

- `npm` package names validated; install uses `execFileSync` (no shell sink).
- `defaultWhich` for binary discovery also uses `execFileSync`.
- Decline → fallback chain logged to `audit.log`, no crash.
- A lazy install helper exists for the browser-need case but is not yet wired from production (see follow-ups).

### 3. Live cost telemetry in the status banner

The pi status banner now surfaces `⚡ $X (last turn)` plus the rolling engagement total. The "last turn" cell turns red (real ANSI escape) above `cost_warn_threshold_usd` (default 0.5 USD). Both displays are individually toggleable under `ui.banner` in `config.yaml`.

---

## v1.0.1 acceptance criteria — verification status

12 items from spec §8. ✅ = verified by tests + dry-run; 🚧 = needs operator-side dogfood before push.

- [x] ✅ `bin/install.js --profile hybrid --planner gpt-5 --operator opus-4-7 --reporter local-llama-70b` writes a config.yaml with those values. *(verified: dry-run `/tmp/dogfood-v101.yaml` shows `planner: gpt-5`, `operator: claude-opus-4-7`, `reporter: local-llama-70b`)*
- [x] ✅ `config.yaml.providers.<name>` entries register with pi via `register-providers.ts` at `session_start`. *(verified: `tests/register-providers.test.ts` 3/3)*
- [x] ✅ `/vibehack-config sync` regenerates prompt frontmatter from current config. *(verified: `tests/rewrite-prompts.test.ts` 3/3)*
- [x] ✅ Hand-edited prompt frontmatter is preserved on subsequent install runs (no clobber). *(verified: `tests/install-config.test.ts` + rewrite-prompts merge logic)*
- [x] ✅ Soft-dep batch prompt fires at `session_start` when any of {pi-super-curl, surf-cli, graphify} are missing. *(verified: detector + flow tests pass)*
- [x] ✅ `auto_install.enabled: false` suppresses the prompt; legacy banner shows. *(verified: config-driven branch covered)*
- [ ] 🚧 Lazy install prompt fires when surf-cli is needed and absent. *(helper exists; not wired from production — `operator-spawn.ts` runs as non-interactive `--no-session` subprocess. Lazy-wire from parent session pre-spawn is on the follow-up list. Marked 🚧 pending dogfood-phase wiring decision.)*
- [x] ✅ Decline → fallback chain logged to `audit.log`; no crash. *(verified by softdeps flow test)*
- [x] ✅ Status banner shows `⚡ $X (last turn)` and turns red above `cost_warn_threshold_usd`. *(verified: `tests/status-banner.test.ts` 10/10, including ANSI escape assertion)*
- [x] ✅ `docs/COMPARISON.md` exists with verified data for H-mmer, XBOW, pentagi. *(landed in Phase 4)*
- [x] ✅ All v1.0.0-rc1 tests still pass (123 baseline). *(verified: 155/155, all baseline suites green)*
- [ ] 🚧 No regressions on existing flows: install → /vibehack <target> → /confirm → /vibehack-complete. *(unit + e2e suites green; needs an operator-side end-to-end dogfood run on a real lab target before push)*

**Score: 10/12 ✅, 2/12 🚧 (gated on dogfood)**

---

## Known follow-ups (deferred to dogfood / Phase 5)

1. **`defaultConfig` drift-test** between `bin/lib/config.js` (install-side) and `extensions/pi-vibehack/lib/config-runtime.ts` (runtime-side) — both currently encode the same defaults; add a parity test before the next minor.
2. **Lazy-install wiring from parent session pre-spawn** — `operator-spawn.ts` runs in non-interactive `--no-session` subprocess and cannot prompt. Decision: detect at parent-session `before_agent_start` and prompt from there, or accept fallback-only inside subprocesses. Tracked.
3. **Replace `shell:true` in graphify `--version` probe** — the `DEP0190` warning surfaces from this site; switch to `execFileSync` like the npm-name path. Cosmetic, non-blocking.

---

## Dogfood gate before Phase 5

Phase 5 (v1.1: browser-CDP, canary suite, self-evolving harness) is gated on this rc1 surviving an operator-side dogfood pass:

- Real `npm install -g` consent flow against missing companions on a clean machine.
- Hand-edit preservation across a re-install on a populated `~/.pi/agent/vibehack/`.
- Full `/vibehack <target> → /confirm → /vibehack-complete` against a real lab target with cost telemetry observed.

The local tag `v1.0.1-rc1` is the checkpoint. **Do not push** until dogfood completes.
