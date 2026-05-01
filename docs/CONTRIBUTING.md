# Contributing

## Adding a recipe skill

1. Create `skills/recipes/<name>/SKILL.md` with frontmatter `name`, `description`.
2. Body: install hint + common idioms + vibehack pattern.
3. Test that it loads: `npm test -- recipes`.

## Adding a specialist

1. Create `skills/specialists/<kind>/SKILL.md`.
2. Frontmatter `name: <kind>-specialist`, `description: ...`.
3. Body: discipline + falsifier tells + outcome decision tree.

## Adding a DCP rule

1. New file in `extensions/pi-vibehack/dcp-rules/`.
2. Export an object with `name`, `prepare(messages)`, `decide(message)`.
3. Add to `extensions/pi-vibehack/dcp-rules/index.ts`.
4. Test in `tests/dcp-rules.test.ts`.

## Adding a slash command

1. New `prompts/<command>.md` with frontmatter.
2. If it needs custom logic beyond LLM dispatch, also `pi.registerCommand` in `index.ts`.

## Tests

Every code change ships with a vitest unit test. Content (skill / prompt) changes do not require tests but must pass `npm run typecheck`.
