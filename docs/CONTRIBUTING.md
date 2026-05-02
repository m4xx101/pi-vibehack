# Contributing to pi-vibehack

Thanks for your interest. This is an opinionated harness — contributions that add capability without bloating the core are welcome.

## Before you start

Read these in order:

1. [README](../README.md) — what pi-vibehack is.
2. [ARCHITECTURE](ARCHITECTURE.md) — design + diagrams.
3. The [9 ADRs](adr/) — why we made each design decision. Especially [ADR-0007 (unleashed scope)](adr/0007-unleashed-scope.md) and [ADR-0009 (specialists as skills)](adr/0009-specialists-as-skills-not-subagents.md). Don't propose changes that violate accepted ADRs without proposing a new ADR first.
4. [EXTENDING](EXTENDING.md) — many useful extensions don't need a PR; they live in your local `~/.pi/agent/vibehack/`. Check there first.

## Development setup

```bash
git clone https://github.com/m4xx101/pi-vibehack
cd pi-vibehack
npm install --legacy-peer-deps
npx vitest run                # confirm tests pass (122 at v1.0.0-rc1)
npm run typecheck             # 5 pre-existing TS7016 warnings expected
```

Make changes. Run tests. Commit per the conventional-commits style:

```
feat(<scope>): <imperative summary>
fix(<scope>): <imperative summary>
docs: <summary>
test: <summary>
chore: <summary>
```

Scopes used in this repo: `events`, `tools`, `hooks`, `dcp`, `recall`, `chain`, `ingest`, `specialist`, `install`, `prompts`, `skills`, `render`, `ui`, `extension`, `e2e`.

## Adding a recipe skill

See [EXTENDING.md → Adding a recipe skill](EXTENDING.md#adding-a-recipe-skill).

Frontmatter requirements (enforced by `tests/recipes.test.ts`):

```yaml
---
name: <slug>-recipes
description: One-line purpose.
---
```

Body must include a "vibehack pattern" section explaining when the planner pulls in this recipe.

Run `npx vitest run tests/recipes.test.ts` to verify.

## Adding a specialist skill

See [EXTENDING.md → Adding a specialist](EXTENDING.md#adding-a-specialist).

Shipped specialists need: verbose `description`, discipline section, falsifier tells, confidence ceiling rules. Add an example invocation to [OPERATOR-GUIDE.md](OPERATOR-GUIDE.md) for major specialists.

## Adding a DCP rule

See [EXTENDING.md → Adding a DCP rule](EXTENDING.md#adding-a-dcp-rule).

Tests in `tests/dcp-rules.test.ts` must cover: prepare correctness, decide correctness, test isolation via `beforeEach` clearing global state.

## Adding a slash command

See [EXTENDING.md → Adding a slash command](EXTENDING.md#adding-a-slash-command).

For prompt-template-model commands: update `bin/lib/rewrite-prompts.js` to include the new prompt in the right role list. Add to [COMMANDS.md](COMMANDS.md).

For extension-handled commands: register in `extensions/pi-vibehack/index.ts`. Add to COMMANDS.md.

## Adding a hook

See [EXTENDING.md → Adding a hook](EXTENDING.md#adding-a-hook).

**Always** wrap handler body in `try/catch`. Never break the pi flow.

## Test discipline

Every code change ships with a vitest test. Every architectural change ships with an ADR.

Conventions:

- `mkdtemp` + `process.env.VIBEHACK_DATA_DIR` for filesystem isolation.
- `beforeEach`/`afterEach` for setup/teardown — design `afterEach` to be **idempotent and crash-safe** (the Phase 27 rewrite-prompts test taught us this).
- Always `await` async functions.
- Mock subprocess spawns where possible — `parseOperatorJson` is unit-testable; `spawnOperator` itself requires a pi binary (deferred to integration smoke).

Running:

```bash
npx vitest run                          # full suite
npx vitest run tests/<file>.test.ts     # one file
npx vitest run -t "<pattern>"           # one test
npx vitest                              # watch mode
```

## Architectural changes

Changes that touch any of:

- The 16 event types in `EventSchema`.
- The 5 mutating tools or 2 proposal tools.
- The 6 lifecycle hooks.
- The 4 DCP rules.
- The Operator/Reporter subprocess return contracts.
- The 6-layer memory model.

require a new ADR in `docs/adr/` (next number after existing). Update [ARCHITECTURE.md → ADR index](ARCHITECTURE.md#adr-index) in the same PR.

## Commit messages

- Conventional-commits prefixes (above).
- Subject line imperative ("add X" not "added X").
- Body explains **why** (the diff shows what).
- Breaking changes: `BREAKING CHANGE:` in the body.
- Architectural: reference ADR number.

## PR checklist

- [ ] Tests pass (`npx vitest run`).
- [ ] Typecheck passes (5 pre-existing warnings tolerated).
- [ ] Docs updated (README / COMMANDS / RECIPES as relevant).
- [ ] CHANGELOG.md updated (Unreleased section).
- [ ] If architectural: new ADR + ARCHITECTURE.md.
- [ ] No new TS errors introduced.
- [ ] `prompts/*.md` files not left dirty by your tests.
- [ ] Branched off `main`, rebased on latest.

## Style

- TypeScript strict where possible.
- ESM. Use `.ts` extension in imports (tsconfig has `allowImportingTsExtensions`).
- No bundler — pi loads via [jiti](https://github.com/unjs/jiti). Keep imports relative + explicit.
- Match the file's existing style. Don't unilaterally refactor.

## Don't

- Don't add a vector DB ([ADR-0002](adr/0002-graphify-as-recall-substrate.md)).
- Don't add a 4th role ([ADR-0009](adr/0009-specialists-as-skills-not-subagents.md)).
- Don't add scope gates ([ADR-0007](adr/0007-unleashed-scope.md)).
- Don't write to events.jsonl outside `appendEvent` (schema validation is the safety net).
- Don't add a router provider ([ADR-0004](adr/0004-prompt-template-model-as-dispatch.md)).

If you think one of these should change: new ADR + concrete data showing the current decision is wrong.

## License

By contributing, you agree your contribution is licensed under MIT.

## Maintainer

[m4xx101](https://github.com/m4xx101). Issues and PRs reviewed on a best-effort basis.
