# pi-vibehack — Resume Checkpoint

**Last updated:** 2026-05-01
**HEAD:** `89b69da` on `main`
**Tests:** 75/75 passing across 5 suites
**Progress:** 14 of 73 tasks complete (Phases 1-4 ✅; Phases 5-27 pending)

---

## How to resume in a fresh session

Hand this entire `RESUME.md` to a fresh Claude Code session along with this prompt:

> Resume the pi-vibehack v1.0 build. The locked design is at `docs/superpowers/specs/2026-04-29-pi-vibehack-design.md` and the executable plan with 73 tasks (27 phases) is at `docs/superpowers/plans/2026-04-29-pi-vibehack.md`. We're using **Option B tiered cadence** from the `superpowers:subagent-driven-development` skill: full 3-subagent cycle (implementer → spec review → code-quality review) for code tasks; implementer + my spot-check for pure-content tasks (markdown skills, prompts, ADRs); I implement directly for trivial wire-ups. Continue from Phase 5 Task 5.1 per the plan. The previous session's progress and known deviations are documented in `RESUME.md` at the repo root — read that first.

---

## What's been built

### Phase 1 — Repository bootstrap ✅
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `LICENSE`, `README.md`, `CHANGELOG.md`
- `Research.txt` and `Deepwiki-details.txt` moved to `docs/research/` (renamed `.txt` → `.md`)
- npm install works with `--legacy-peer-deps` (peer-dep transitive postinstall fails without; advisory anyway)

### Phase 2 — Install/uninstall flow ✅
- `bin/lib/settings.js` — idempotent settings.json package patcher with version-replace + scoped-name foot-gun guard
- `bin/lib/profile.js` — three model profiles (`hybrid`/`local`/`frontier`) × planner/operator/reporter
- `bin/lib/data-dir.js` — skeleton creation + AGENTS.md preservation + profile JSON persist
- `bin/install.js` — CLI entrypoint (`install`/`uninstall`), `--profile`/`--planner`/`--operator`/`--reporter`/`--local`/`--data-dir` flags
- 13 install tests + 7 profile tests = 20 install-flow tests

### Phase 3 — Event log + tree rendering ✅
- `extensions/pi-vibehack/lib/event-schema.ts` — typebox `EventSchema`, `EvidenceSchema`, `EventTypes` (16 events), strict ISO 8601 date-time format, `additionalProperties: false`, non-negative cost minimums
- `extensions/pi-vibehack/lib/events.ts` — `eventsPath`, `appendEvent` (validates schema before write), `readEvents` (resilient: skips malformed lines with `console.warn` by default; `{ strict: true }` throws; `{ validate: true }` schema-checks each line), `nowIso`, `newNodeId` (throws on siblingCount ≥ 26)
- `extensions/pi-vibehack/render/tree-md.ts` — `foldNodes`, `STATUS_EMOJI`, `renderTreeMd` (deterministic — sorted-key cost rollup, cycle guard via `visited` Set, orphan-event warning)
- `extensions/pi-vibehack/render/findings-md.ts` — `renderFindingsMd` (confirmed leaves only, sorted by node_id)
- 24 events-schema tests + 14 tree-render tests = 38 rendering/schema tests

### Phase 4 — Custom Planner tools (9 tasks) ✅
- `extensions/pi-vibehack/lib/engagement.ts` — `vibehackRoot()` (honors `VIBEHACK_DATA_DIR` env), `engagementsRoot`, `engagementDir`, `activeEngagementId`/`setActiveEngagement` (marker file at `<vibehackRoot>/.active`), `slugify` (NFKD-folded, returns `"untargeted"` on empty input, trims trailing hyphen post-truncation), `newEngagementId`
- 7 mutation tools: `vibehack_expand` (falsifier-required for non-root), `vibehack_prune`, `vibehack_confirm` (no `trigger_reporter` flag — Phase 27.3 hook will read events directly), `vibehack_evidence`, `vibehack_dead_end`, `vibehack_propose_chain`, `vibehack_propose_specialist`
- `tools/index.ts` — barrel export + **`HYPOTHESIS_MUTATING_TOOLS`** (5 entries: expand/prune/confirm/evidence/dead_end) + **`PROPOSAL_TOOLS`** (2 entries: propose_chain/propose_specialist) + `PLANNER_TOOL_NAMES` (8: 7 above + `vibehack_recall` forward-reference for Phase 12)
- 17 planner-tool tests (7 tool smokes + active-engagement guard + set partitioning + slugify edge cases)

### Test totals: 75 passing across 5 suites
- `tests/install.test.ts` (13)
- `tests/profile.test.ts` (7)
- `tests/events-schema.test.ts` (24)
- `tests/tree-render.test.ts` (14)
- `tests/planner-tools.test.ts` (17)

---

## Critical deviations from the original plan

These were applied during execution and the plan file (`docs/superpowers/plans/2026-04-29-pi-vibehack.md`) was updated in lockstep where it affected later tasks. Future tasks must respect them.

1. **Peer-dep names corrected.** Plan originally said `@nicobailon/pi-prompt-template-model@^1.0.0` and `pi-dcp@^1.0.0` — neither resolves on npm. Real registry names: `pi-prompt-template-model@^0.9.0` and `@zenobius/pi-dcp@^0.1.0`. Both `package.json` and the plan's Task 2.4 install.js code block were updated.

2. **`HYPOTHESIS_MUTATING_TOOLS` set split.** Plan had all 7 mutation+proposal tools in a single set. **Phase 5's hypothesis-or-die invariant must use `HYPOTHESIS_MUTATING_TOOLS` (5 entries, NOT 7)** — proposals don't satisfy the invariant because they stage operator-gated changes. `PROPOSAL_TOOLS` is the separate set.

3. **`vibehack_confirm` does NOT set `trigger_reporter: true` in details.** Phase 27.3's `tool_result` hook reads `event === "confirm"` directly from events.jsonl as the single source of truth. Drop any reference to a `details.trigger_reporter` flag.

4. **`event-schema.ts` registers a `FormatRegistry.Set("date-time", ...)` validator** at module load (idempotent via `Has` guard). Strict ISO 8601 regex requiring timezone — `2026-04-29` (bare date), `April 29 2026`, `2026-04-29T10:23:45` (no TZ) all fail.

5. **`additionalProperties: false`** on both `EvidenceSchema` and `EventSchema` — typo'd field names get rejected at append time. Future schema changes need explicit field additions.

6. **`cost_tokens` and `cost_usd` are `Type.Number({ minimum: 0 })`.** Negative costs are bugs by definition.

7. **`foldNodes` cost-update semantics: REPLACE, not accumulate.** `node_update.cost_usd: 0.05` means "this node now costs $0.05" (snapshot total). Producers must emit cumulative totals. If you want incremental deltas, rename the schema field.

8. **`foldNodes` orphan handling.** Orphan `node_update`/`node_prune`/`confirm`/`evidence_add` events (no prior `node_add` for that node_id) are skipped with `console.warn` (not silently dropped, not thrown).

9. **`renderTreeMd` cycle guard.** `walk()` carries a `visited: Set<string>` to prevent stack overflow on cyclic `parent_id`. Cycle detected → emits `⚠️ cycle detected at <id>` line, doesn't recurse.

10. **`renderTreeMd` unmapped-status fallback is `❓`** (not the plan's `🌳`) — visible signal that schema added a status without updating `STATUS_EMOJI`.

11. **`newNodeId` throws on siblingCount ≥ 26.** The Planner enforces breadth ≤ 8, so 26 is genuinely impossible-in-practice; throw is defensive. Phase 5/6 system prompts should know to call `vibehack_prune` if `vibehack_expand` fails with "breadth limit" error.

12. **`readEvents` is resilient by default.** Malformed JSON line → `console.warn` + skip. `{ strict: true }` → throws on first bad line. `{ validate: true }` → also schema-checks each line.

13. **`bin/install.js` resolves settings path via `resolveSettingsPath(args)` helper** (DRY across install/uninstall). Uninstall message reports actual `--data-dir` instead of hardcoded `~/.pi/agent/vibehack/`.

14. **Soft-dep install hints in `bin/install.js` are unconditional and advisory only.** Runtime detection lives in Phase 27.10's `session_start` banners (NOT in install.js). Install hints have an inline `// advisory; runtime detection in 27.10` comment.

15. **`slugify` returns `"untargeted"` for empty/all-symbol input** rather than empty string. Prevents engagement IDs from ending in bare hyphens.

---

## Pacing strategy in use (Option B)

Per the user's choice on 2026-05-01:

- **Code tasks** (logic, hooks, schemas, libs, tests): **full 3-subagent cycle** (implementer → spec review → code-quality review).
- **Pure-content tasks** (markdown skills, prompt frontmatter files, ADRs, persona files, recipe SKILL.md, docs): **implementer only + controller spot-check** (no code-quality reviewer — no code to review).
- **Trivial wire-ups** (single-file barrel exports, command registrations that are 5-line patches): **controller implements directly**, no subagent.

For tightly-coupled phases (Phase 4 was an example), **phase-batched dispatch** is acceptable: one implementer for all sub-tasks if they share a common TDD pattern. Reviewer agents work at phase level rather than per-task.

---

## What's next: Phase 5

**Phase 5 — Hypothesis-or-die enforcement (`tool_call` + `tool_result` hooks).** 3 tasks:

- 5.1 — `extensions/pi-vibehack/lib/turn-state.ts` (per-turn mutation tracker; uses `HYPOTHESIS_MUTATING_TOOLS` Set from Phase 4 — see deviation #2)
- 5.2 — `extensions/pi-vibehack/hooks/tool-call.ts` (audit log + cost tally; unleashed scope, never blocks)
- 5.3 — `extensions/pi-vibehack/hooks/tool-result.ts` + `getMutationGateMessage()` helper (the "[VIBEHACK INVARIANT] Last turn produced no tree mutation..." injection used by `before_agent_start` in Phase 10)

After that:

- **Phase 6** — Negative-space synthesis (HTTP header diff + filtered-port detection wired into `tool_result` hook). 2 tasks.
- **Phase 7** — Subprocess plumbing (Operator + Reporter spawn + role files). 4 tasks.
- **Phase 8** — Auto-handoff prompt builder. 1 task.
- **Phase 9** — Provider personas (CLAUDE/CODEX/GEMINI/LOCAL.md) + persona detection. 2 tasks (Task 9.1 is 4 markdown files — pure content).
- **Phase 10** — `before_agent_start` hook + Planner system prompt. 2 tasks.
- **Phase 11** — pi-dcp rules (4 rules). 1 task with 8 steps.
- **Phase 12** — graphify recall + `vibehack_recall` tool. 2 tasks. Adds the missing forward-referenced tool.
- **Phase 13** — `before_provider_request` injection. 1 task.
- **Phase 14** — `session_start` + `session_before_compact` + lessons.jsonl. 3 tasks.
- **Phase 15** — TUI (status banner + tree viewer). 3 tasks.
- **Phase 16** — Frontmatter slash commands (17 prompt files — pure content).
- **Phase 17** — Recipe skills (9 SKILL.md files — pure content).
- **Phase 18** — Specialist skills (5 SKILL.md files — pure content).
- **Phase 19** — pi-super-curl integration. 1 task.
- **Phase 20** — Browser automation. 1 task.
- **Phase 21** — Tool-ingest (4 modes). 2 tasks.
- **Phase 22** — Specialist runtime. 1 task.
- **Phase 23** — Chain runner. 1 task.
- **Phase 24** — Top-level extension entry (`extensions/pi-vibehack/index.ts`). 1 task. Wires everything.
- **Phase 25** — 9 ADRs + 4 user docs. Pure content.
- **Phase 26** — DVWA smoke test + v1.0 tag. 2 tasks.
- **Phase 27** — Integration gap-fixes (12 tasks: pi presence check, frontmatter rewriting, per-leaf reporter wiring, `/steer` machinery, PATH shim wiring, specialist-ingest routing, global graphify, recipes test, depth/breadth advisory, soft-dep banners, env-with-shim, final smoke).

---

## Commit log (most recent first)

```
89b69da fix(tools): split mutation vs proposal sets, drop trigger_reporter flag, harden slugify, add 5 smoke tests
2371dc8 feat(tools): planner tool barrel + invariant set
aabecd0 feat(tools): vibehack_propose_specialist
76b89e2 feat(tools): vibehack_propose_chain (operator-gated chains)
4d1b265 feat(tools): vibehack_dead_end
4f19889 feat(tools): vibehack_evidence
270cc9b feat(tools): vibehack_confirm flags reporter trigger
f657a2b feat(tools): vibehack_prune
29cf21f feat(tools): vibehack_expand with falsifier-required invariant
0173b04 feat(engagement): active-engagement marker + slug helpers
b792b8e feat(render): findings.md projection of confirmed leaves
69d5470 feat(render): tree.md projection with foldNodes + deterministic render
6e76afa feat(events): append/read JSONL helpers + node-id generator
bcbae4a feat(events): typebox schema + validation tests
151b09e feat(install): CLI entrypoint with install/uninstall commands
355751b feat(install): data dir bootstrap helpers
edc5f41 feat(install): profile + per-role override resolver
63ced78 feat(install): idempotent settings.json package patcher with tests
a243fdb chore: bootstrap pi-vibehack repo with tooling
```

---

## Sanity-check commands for the resuming session

```bash
cd C:/Users/m4xx/OneDrive/Documents/pi-hack
git log --oneline -20                # confirm HEAD = 89b69da
npm install --legacy-peer-deps       # if node_modules missing
npx vitest run                        # confirm 75/75 pass across 5 suites
npm run typecheck                     # should pass
ls extensions/pi-vibehack/            # lib/, render/, tools/ present
ls extensions/pi-vibehack/lib/        # engagement.ts, event-schema.ts, events.ts
ls extensions/pi-vibehack/tools/      # 8 tool files + index.ts
```

If any of these fail, do not proceed to Phase 5 — investigate the divergence first.
