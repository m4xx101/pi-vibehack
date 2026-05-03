# pi-vibehack — Troubleshooting

Common problems and their fixes. Symptom → diagnosis → fix.

## Install issues

### `pi: command not found`

**Symptom:** `npx -y @m4xx101/vibeshack install` exits with `✗ pi (pi-mono) is not on PATH.`

**Fix:**
```bash
npm install -g @mariozechner/pi-coding-agent
which pi   # verify it's on PATH
```

Then re-run the install.

### `npm install` fails with peer-dep errors

**Symptom:** Installing pi-vibehack throws ERESOLVE because `pi-prompt-template-model` or `@zenobius/pi-dcp` peer deps don't resolve cleanly.

**Fix:**
```bash
npx -y @m4xx101/vibeshack install
# OR if that fails:
npm install -g pi-prompt-template-model @zenobius/pi-dcp
npx -y @m4xx101/vibeshack install
```

If you're developing in the repo directly, use `npm install --legacy-peer-deps`.

### `graphify` / `surf-cli` / `pi-super-curl` missing

**Symptom:** `session_start` shows `💡 install ...` banners.

**Fix:** Each is optional. Install only what you need:

```bash
# Cross-engagement recall — strongly recommended
# (graphify install command depends on its own packaging — check its README)

# HTTP/auth power-ups
npm i -g pi-super-curl

# Browser automation
npm i -g surf-cli
```

The harness degrades gracefully without them — recall falls back to grep, browser leaves use playwright fallback or just curl, scurl integration silently no-ops.

## Engagement issues

### "no active engagement (call /vibehack <target> first)"

**Symptom:** Any tree mutation tool throws this.

**Diagnosis:** The harness lost track of the active engagement. Marker file is at `~/.pi/agent/vibehack/.active`.

**Fix:**
```bash
cat ~/.pi/agent/vibehack/.active                  # is it set?
ls ~/.pi/agent/vibehack/engagements/              # is the dir present?
```

In pi:
```
/vibehack <target>          # start fresh engagement
# OR
/vibehack-resume <id>       # resume specific engagement by id
```

### `tree.md` doesn't update

**Symptom:** You issued `/expand` or `/confirm` but `tree.md` looks stale.

**Diagnosis:** `tree.md` is rendered by the `tool_result` hook → `renderEngagement()`. If the hook didn't fire (e.g., tool errored), no render.

**Fix:**
```
/vibehack-tree     # forces re-render via the command's handler
```

If still stale: check `~/.pi/agent/vibehack/engagements/<id>/events.jsonl` — is your mutation event there? If not, the tool failed; check audit.log.

### `[VIBEHACK INVARIANT] Last turn produced no tree mutation` keeps firing

**Symptom:** Every Planner turn is gated.

**Diagnosis:** The Planner is calling tools but none are in `HYPOTHESIS_MUTATING_TOOLS` (the 5: expand/prune/confirm/evidence/dead_end). Common causes:

- Planner is only calling `vibehack_propose_chain` or `vibehack_propose_specialist` — these stage proposals but don't satisfy the invariant (per design — see [ADR-0009](adr/0009-specialists-as-skills-not-subagents.md) and the gate-message wording).
- Planner is only calling `vibehack_recall` or `read` — recall is read-only, doesn't count.

**Fix:** Operator should `/steer the Planner is stuck — run vibehack_dead_end on n_<id> with a clear reason and pivot to a sibling`. Or `/expand <node>` manually to break the loop.

## Subprocess issues

### Operator subprocess hangs

**Symptom:** A long pause after `/confirm <node_id>` with no output.

**Diagnosis:** `spawnOperator` has a `timeoutMs` of 600,000ms (10 min). Could be:
- pi binary stuck waiting for input.
- LLM provider taking forever.
- Endpoint the Operator is probing is slow.

**Fix:** Wait it out (10 min cap), or send `Ctrl+C` to the pi process. Note: `Ctrl+C` will kill the entire pi session, not just the subprocess. The subprocess timeout will eventually fire and the Planner will see a thrown error.

### Operator returns `outcome: "blocked-on-auth"` and nothing happens

**Symptom:** Operator finishes with blocked-on-auth, but `/scurl` doesn't fire.

**Diagnosis:** This integration requires `pi-super-curl` to be installed. Check:

```bash
which scurl
ls ~/.pi-super-curl/config.json 2>/dev/null
```

**Fix:** `npm i -g pi-super-curl` and `/reload`. Without scurl, the Planner sees the structured output but has no `/scurl` command to invoke; it should pivot to `vibehack_dead_end` or recommend the operator handle auth manually.

### "operator returned no parseable JSON"

**Symptom:** `parseOperatorJson` couldn't extract a structured return.

**Diagnosis:** The Operator subagent narrated outside the JSON or didn't use `terminate=true`. Check `audit.log` for the full stdout.

**Fix:** Improve the Operator's discipline by editing `subagents/vibehack-operator.md` — add a stronger "do not narrate outside JSON" rule. Or pin a more rigid model (e.g., switch from Sonnet to Opus for that role via `--operator claude-opus-4-7`).

## Recall layer

### `<recall>` blocks always say "no recall hits"

**Diagnosis:** Either:
1. graphify isn't installed (fallback grep finds nothing).
2. The fallback grep is looking in the wrong place. Check `~/.pi/agent/vibehack/engagements/*/events.jsonl` — are there any?
3. Your query doesn't match anything (this is the first engagement against this stack).

**Fix:** First engagement is always sparse. By engagement 3 you should see hits. Run `/vibehack-recall <query>` manually with broad keywords to test the substrate.

### graphify update silently failing

**Symptom:** `triggerGraphifyUpdate` is supposed to fire on confirm/evidence but no graph data accumulates.

**Diagnosis:** On Windows, `graphify` is often a `.cmd` shim — Node's `child_process.spawn` without `shell: true` ENOENTs. We use `shell: true` on Windows ([Phase 12 fix](../docs/superpowers/plans/2026-04-29-pi-vibehack.md)), but check the spawn is actually firing:

```bash
graphify --version    # should print version
```

If graphify itself is broken: the harness silently falls back to grep. No data loss, just no graph compounding until graphify is fixed.

## DCP / context budget

### Planner forgets recent context

**Symptom:** The Planner asks about something that was just established 2 turns ago.

**Diagnosis:** A DCP rule is over-pruning. The 4 rules:

- `prune-stale-recall` — keeps current `<recall>` only.
- `prune-stale-tool-results` — keeps last 4 turns of tool results.
- `prune-folded-evidence` — drops working-context tool results once their evidence has been folded.
- `prune-dead-branches` — drops messages tagged with dead/pruned node_ids.

**Fix:** If `prune-stale-tool-results` is too aggressive, bump `KEEP_LAST_N_TURNS` in `extensions/pi-vibehack/dcp-rules/prune-stale-tool-results.ts`.

If `prune-dead-branches` is dropping nodes you don't expect, check whether `markNodeDead()` was called on nodes that are still active.

If you're not sure: the source of truth is always `events.jsonl`. The Planner can `/vibehack-tree` to see it.

## Browser leaves

### `requires_browser: true` doesn't load a browser recipe

**Diagnosis:** `detectBrowserBackend()` returned `"none"`. Neither `surf` nor `playwright` (nor `npx`) were on PATH.

**Fix:**
```bash
which surf
which playwright
which npx                 # playwright fallback uses npx playwright
npm i -g surf-cli         # preferred
# OR
npm i -g playwright       # fallback
```

On Windows, all three are likely `.cmd` shims — the `binExists` helper uses `shell: true` to handle that.

## Tool ingest

### Synthesis fails / rolls back

**Symptom:** `/vibehack-ingest "do X"` reports failure and the tool dir is gone.

**Diagnosis:** The validation gate failed. Either:
- The tool's `--help` exited non-zero.
- `--validate-against` was supplied and the tool didn't produce non-empty output against it.

**Fix:** Re-run with `--validate-against <good-target>` so the Operator subprocess has a concrete sanity check. Or read the audit.log for the failure stdout/stderr.

### PATH shim conflicts with my system PATH

**Symptom:** A system tool you wanted to use is being shadowed by an ingested one.

**Fix:** Two options:
1. Inspect `~/.pi/agent/vibehack/tools/PATH-shim.sh` — manually remove the shadowing entry.
2. Re-ingest with `--prefix` (when implemented) so vibehack tools get a `vibehack-` namespace.

For now, if you need to remove an ingested tool: `rm -rf ~/.pi/agent/vibehack/tools/<slug>` and `~/.pi/agent/vibehack/skills/learned/<slug>`. Run `/reload`.

## Frontmatter dispatch

### Wrong model fires for a slash command

**Symptom:** You ran `/expand` and Opus fired instead of Haiku (or vice versa).

**Diagnosis:** The prompt's `model:` line was rewritten by `--profile` at install time. Check:

```bash
head -5 ~/.pi/agent/vibehack/.profile
grep "^model:" ~/path/to/pi-vibehack/prompts/expand.md   # for source-installed
```

**Fix:** Reinstall with the right profile:

```bash
npx -y @m4xx101/vibeshack install --profile hybrid --planner claude-haiku-4-5
```

This re-runs the `rewritePromptsForProfile` step and updates `prompts/*.md` accordingly.

## Determinism / replay

### `tree.md` differs across runs of the same events.jsonl

**Symptom:** Two `renderEngagement()` calls produce different output.

**Diagnosis:** Should never happen — `tree-render.ts` sorts children by node_id, iterates sorted node-ids for cost rollup, and uses `walk()` deterministically. If you see drift:

1. Check for clock skew in `ts` fields.
2. Check for cycle (ADR-flagged in code; logs `⚠️ cycle detected`).
3. Confirm both runs are reading the same events.jsonl (no concurrent writer).

**Fix:** If reproducible, file an issue with the events.jsonl + the two divergent tree.md outputs. This is a determinism bug.

## Authorization / forensics

### "Did the harness actually do X?"

**Diagnosis:** Every tool call hits the audit log.

**Fix:**
```bash
cat ~/.pi/agent/vibehack/engagements/<id>/audit.log | grep tool=bash | grep <command>
```

The audit log is plaintext, append-only, timestamped. Forensic record.

### "What URLs did the Operator probe during this engagement?"

```bash
grep -E "tool=bash" ~/.pi/agent/vibehack/engagements/<id>/audit.log \
  | grep -oE 'https?://[^ "]+' | sort -u
```

## Windows-specific notes

### CRLF line-ending warnings on every git operation

**Symptom:** `warning: in the working copy of 'X', LF will be replaced by CRLF...`

**Diagnosis:** Windows + Git's `core.autocrlf=true`. Cosmetic only — content is always LF in the repo, CRLF in the working tree.

**Fix:** Ignore. Or set `git config --global core.autocrlf input` to keep working-tree as LF.

### `.cmd` shims fail to spawn

**Symptom:** Some external tool isn't being detected by `binExists` or `which`.

**Diagnosis:** Node's `child_process.spawn` won't direct-call `.cmd`/`.bat` files. We use `shell: process.platform === "win32"` everywhere, but if you're calling a tool from a custom hook, do the same.

### `DEP0190` deprecation warning during tests

**Symptom:** `(node:NNNN) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true...`

**Diagnosis:** Node deprecates `shell: true` with array-form arguments. We use this pattern for cross-platform `.cmd` resolution. Real impact: zero. Migration: convert to single-string commands or use `shelljs`/`execa`.

**Fix:** Tracked for v1.0.1 cleanup. Not a blocker.

## TS7016 typecheck warnings

**Symptom:** `npm run typecheck` reports `TS7016: Could not find a declaration file for module './lib/data-dir.js'`.

**Diagnosis:** `bin/lib/*.js` are plain JS without `.d.ts` companions. TypeScript imports in `extensions/pi-vibehack/lib/*.ts` and tests trigger the warning.

**Fix:** Pre-existing; tracked for v1.0.1. Either generate `.d.ts` shims or convert the bin/lib/*.js files to TS. Not a runtime issue.

## Test isolation issues

### `prompts/*.md` files show as modified after running tests

**Symptom:** `git status` shows uncommitted changes to prompt files; the diff shows `model: test-planner` etc.

**Diagnosis:** The `rewrite-prompts.test.ts` test mutates prompt files in place. If the test crashes mid-run (vitest worker killed, quota timeout, OOM), the `afterEach` cleanup may not fire.

**Fix:**
```bash
git checkout -- prompts/
```

The test was hardened in [Phase 27.2](../RESUME.md#phase-272) to save/restore all prompts; this only happens in pathological vitest crashes now.

## When all else fails

```bash
cd <pi-vibehack-repo>
git status                    # any uncommitted state?
npx vitest run                # do tests pass?
npm run typecheck             # any new TS errors?
cat ~/.pi/agent/settings.json | jq .packages   # is vibehack registered?
ls -la ~/.pi/agent/vibehack/  # data dir intact?
```

If state is corrupted:
```bash
# Nuclear: remove vibehack from settings, preserve engagement data
npx @m4xx101/vibeshack uninstall

# Re-install fresh
npx -y @m4xx101/vibeshack install
```

Engagement data at `~/.pi/agent/vibehack/engagements/` is preserved across uninstall.

## `bunx git-hooks` postinstall failure (handled automatically)

`@zenobius/pi-dcp` (Dynamic Context Pruning) has a transitive `@stacksjs/clarity` whose postinstall calls `bunx git-hooks` (a non-existent package). This used to crash pi at boot because pi-mono lazy-installs settings.json packages.

**v1.1.0+ handles this automatically.** Every install runs a preflight step:

1. `npm install -g @zenobius/pi-dcp@^0.1.0 --ignore-scripts` (skips the broken postinstall)
2. Add pi-dcp to `~/.pi/agent/settings.json`
3. When pi boots, it sees pi-dcp is already globally installed at the right version and skips its own install attempt

Result: no operator action required. If preflight fails (offline / registry down), pi-dcp is silently skipped and pi boots without Dynamic Context Pruning rather than crashing.

If you hit the same `bunx git-hooks` error installing pi-mono manually:

```bash
npm install -g @mariozechner/pi-coding-agent --ignore-scripts
```

## WSL: Windows `pi.exe` shadowing Linux `pi`

Symptom: after installing pi inside WSL, `pi --version` still runs the Windows binary because `/mnt/c/...` precedes the Linux npm global bin in `$PATH`.

Fix:

```bash
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
which pi   # should now show ~/.nvm/.../bin/pi or similar Linux path
```

## Auditing the install (optional)

```bash
cd "$(npm root -g)/@m4xx101/vibeshack"
npm audit --omit=dev
```

The repo's dev-deps (vitest, etc.) are flagged with several low/moderate vulns but they don't ship in the production global install. `--omit=dev` filters them out.
