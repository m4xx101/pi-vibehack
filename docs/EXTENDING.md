# Extending pi-vibehack

The harness is designed to grow with the operator. This guide covers every extension point.

## Adding a recipe skill

When you find yourself reaching for the same tool repeatedly, ship a recipe.

```
~/.pi/agent/vibehack/skills/learned/<your-tool>/SKILL.md
```

Or for shipped recipes (in this repo):

```
skills/recipes/<your-tool>/SKILL.md
```

Required frontmatter:

```yaml
---
name: your-tool-recipes
description: One-line purpose. Be specific — this is what the agent sees.
---
```

Body should include:

- A `## Install` block with the install command.
- 3–5 common idioms with concrete examples.
- A `## vibehack pattern` section explaining when/how the planner should pull the recipe in (which `recipe_hints` value, which leaf phase).
- An "evidence convention" — where the operator should save raw output (`evidence/<node_id>-<slug>.txt`).

Tests in `tests/recipes.test.ts` enforce:

- Frontmatter present (`---` delimited, `name:` and `description:`).
- Body contains "vibehack" or "discipline" (loose check that you wrote a vibehack-pattern section).

After dropping the file, run `/reload` in pi.

## Adding a specialist

Two paths:

### Path A: Hand-write

```
~/.pi/agent/vibehack/specialists/learned/<kind>/SKILL.md
```

Frontmatter:

```yaml
---
name: <kind>-specialist
description: Specialist for <focus>. Pinned to nodes via vibehack_propose_specialist.
---
```

Body should cover:

- **Discipline** — concrete rules the Operator must follow.
- **Common techniques** — toolchain + decision tree.
- **Falsifier tells** — what makes a leaf falsified vs inconclusive.
- **Confidence ceiling rules** — when to cap confidence below 1.0.

The 5 shipped specialists are good templates. See `skills/specialists/web-exploit/SKILL.md` for a worked example.

### Path B: Auto-draft via /vibehack-ingest

```
/vibehack-ingest --specialist phishing
```

The harness spawns an Operator subprocess (frontier, xhigh thinking) that:

1. Researches the specialist domain.
2. Drafts a SKILL.md following the standard template.
3. Validates that the frontmatter parses.
4. Lands the file at `~/.pi/agent/vibehack/specialists/learned/phishing/SKILL.md`.

After ingest, run `/reload`. New specialist is available for `vibehack_propose_specialist(node_id, "phishing")`.

## Adding a tool via /vibehack-ingest (4 modes)

This is the matrix-glitch — the harness builds tools on demand.

### Mode 1: CLI on PATH

```
/vibehack-ingest subfinder
```

The harness:
1. `which subfinder` → confirms it's on PATH.
2. Captures `subfinder --help`.
3. Drafts `~/.pi/agent/vibehack/skills/learned/subfinder/SKILL.md` with the help text + a vibehack-pattern section.

Use when: a tool is already installed, you just want the harness to know how to use it.

### Mode 2: Public git repo

```
/vibehack-ingest https://github.com/projectdiscovery/notify
```

The harness:
1. Clones to `~/.pi/agent/vibehack/tools/notify/` (depth-1).
2. Reads README + `--help`.
3. Drafts a recipe + install/build steps.
4. Refreshes `tools/PATH-shim.sh` so spawned Operator subprocesses can find the binary.

Use when: a tool is on GitHub but not yet installed locally. Vibehack handles install + recipe in one step.

### Mode 3: Synthesis (name + description)

```
/vibehack-ingest "wayback URL collector that paginates and filters by .js files"
/vibehack-ingest --validate-against https://example.com "subdomain takeover detector for AWS S3"
```

The harness spawns an Operator subprocess (frontier, xhigh thinking) that:

1. Plans the tool: language (Python preferred for OSINT/parsing; Go for network-heavy), entrypoint, deps.
2. Writes to `~/.pi/agent/vibehack/tools/<slug>/{bin/<name>, README.md, requirements.txt or go.mod}`.
3. Validates: runs `bin/<slug> <validate_against>` and checks code 0 + non-empty output. If `--validate-against` not supplied, falls back to `--help` exit-code 0.
4. On validation fail: `fs.rm` the directory and exit non-zero.
5. On success: writes the recipe SKILL.md, refreshes the PATH shim, appends a `vibehack_tool` event so the global graphify graph indexes it.

Use when: the tool you want doesn't exist yet. The harness writes it.

### Mode 4: Inline spec

```
/vibehack-ingest --inline "I need a tool that takes a domain and returns paginated wayback URLs filtered by .js"
```

Same as Mode 3 but operator-authored brief instead of name-as-description.

Use when: you want fine-grained control over the tool's interface.

### Operator subprocess and the PATH shim

When the Operator subprocess is spawned (chain mode or via `/confirm`), it inherits PATH from the harness. The harness uses `envWithShim()` to prepend `~/.pi/agent/vibehack/tools/*/bin` to PATH. Plus, the `subagents/vibehack-operator.md` system prompt instructs the Operator to source `~/.pi/agent/vibehack/tools/PATH-shim.sh` at the top of its bash session — belt-and-suspenders.

So any tool you `/vibehack-ingest` is available to the Operator on its very next spawn. No `pi` restart needed.

## Adding a slash command

### Pure prompt-template-model command

For commands that just dispatch the LLM with a different model/skill/thinking:

```
prompts/<command-name>.md
```

```yaml
---
description: One-line purpose
model: claude-haiku-4-5
thinking: minimal
skill: planner-recipes
restore: true
---

Free-form prompt body. Use $1 / $2 / $@ / $ARGUMENTS for arg interpolation.
```

When you reload pi, the command is available as `/<command-name>`.

For commands that delegate to a subagent (Operator/Reporter):

```yaml
---
model: claude-opus-4-7
thinking: high
skill: operator-recipes
subagent: vibehack-operator
inheritContext: false
---

(prompt body)
```

`inheritContext: false` is the **isolation flag** — without it, the subagent sees the Planner's transcript, breaking [ADR-0006](adr/0006-subprocess-isolation-for-untrusted-output.md).

### Extension-handled command (custom logic)

For commands that need filesystem access, subprocess spawning, or stateful interaction beyond LLM dispatch:

1. Create the prompt file with `restore: false` (no LLM dispatch — the body is just documentation).
2. Register a handler in `extensions/pi-vibehack/index.ts`:

```ts
pi.registerCommand?.("my-command", {
  description: "What it does",
  handler: async (args: string, ctx: any) => {
    // your logic
    ctx.ui.notify("done", "info");
  },
});
```

The 5 commands wired this way at v1.0: `vibehack-tree`, `vibehack-cost`, `vibehack-update`, `vibehack-pin`, `vibehack-handoff`, `vibehack-chain-confirm`, `vibehack-chain-reject`, `steer`.

## Adding a DCP rule

A DCP rule is an object with `name`, `prepare(messages)`, and `decide(message)`:

```ts
// extensions/pi-vibehack/dcp-rules/my-rule.ts
export const myRule = {
  name: "vibehack:my-rule",
  prepare(messages: any[]): any[] {
    // tag messages that should be pruned via _vibehack_dcp.<flag>
    return messages.map((m) => {
      if (shouldPrune(m)) {
        return { ...m, _vibehack_dcp: { ...(m._vibehack_dcp ?? {}), my_rule: true } };
      }
      return m;
    });
  },
  decide(message: any): "prune" | "keep" {
    return message?._vibehack_dcp?.my_rule ? "prune" : "keep";
  },
};
```

Register it in `extensions/pi-vibehack/dcp-rules/index.ts`:

```ts
import { myRule } from "./my-rule.ts";
export const ALL_DCP_RULES = [
  pruneStaleRecallRule,
  pruneStaleToolResultsRule,
  pruneFoldedEvidenceRule,
  pruneDeadBranchesRule,
  myRule, // ← add here
];
```

Add a unit test in `tests/dcp-rules.test.ts`. Run `npx vitest run dcp-rules`.

## Adding a hook

Pi exposes ~12 lifecycle events. We use 6. To add one:

```ts
// extensions/pi-vibehack/hooks/my-hook.ts
export function registerMyHook(pi: any) {
  pi.on("some_event", async (event: any, ctx: any) => {
    // your logic
    // wrap in try/catch — never break the flow
  });
}
```

Wire it from `extensions/pi-vibehack/index.ts`:

```ts
import { registerMyHook } from "./hooks/my-hook.ts";
// ... inside the default vibehack(pi) export ...
registerMyHook(pi);
```

The 6 hooks at v1.0: `session_start`, `before_agent_start`, `tool_call`, `tool_result`, `before_provider_request`, `session_before_compact`.

## Adding a custom LLM provider

pi-mono has its own MODELS registry. Custom providers (LM Studio, Ollama, vLLM, custom HTTP-shaped APIs) register via `pi.registerProvider`:

See [pi-mono extensions docs](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md#registering-a-custom-llm-provider) for the full pattern.

For pi-vibehack, the relevant point is: once registered, you can pin any model from the custom provider via the standard frontmatter:

```yaml
---
model: my-local-server-name
thinking: medium
---
```

Or via `--profile local --planner my-local-server-name --operator my-local-server-name --reporter my-local-server-name` at install time.

## Auto-distillation

`/vibehack-distill` reads the last N engagements' events.jsonl, extracts recurring `(situation → action → outcome)` triples, and writes refined recipes into `skills/learned/`.

The `distill-recipes` SKILL.md teaches the LLM how to do this. The pattern:

1. For each confirmed leaf across recent engagements, build a triple.
2. Cluster triples by stack signature (cosine similarity ≥ 0.8 if embeddings available, string-equality fallback).
3. For each cluster of cardinality ≥ 2, generate a `skills/learned/<slug>/SKILL.md` with frontmatter description summarizing the recurring pattern and a body containing variations + canonical replay snippet.
4. If cluster cardinality ≥ 5, mark `priority: high`.

Run after every 3–5 engagements to compound the harness's competence.

`/vibehack-distill --specialists` does the same but for specialist skills — refines the 5 shipped specialists based on which were used in successful confirmations.

## Reload semantics

After landing any new recipe, specialist, prompt, hook, DCP rule, or extension code:

```
/reload
```

This is hot-reload — pi re-discovers skills + re-loads extensions. No `pi` restart required.

For changes to extensions in the npm package itself (e.g., you edited `extensions/pi-vibehack/index.ts`), run `pi-vibehack update` (or `/vibehack-update` from inside pi) to pull the latest published version and re-run install. For local development against a checked-out clone, use `npm install -g .` from the repo root and `/reload` in pi.

## Versioning your extensions

Operator-grown content lives at `~/.pi/agent/vibehack/`:

```
skills/learned/         ← recipe skills
specialists/learned/    ← specialist skills
tools/                  ← ingested + synthesized tools
```

This directory is **operator-owned** — not version-controlled by pi-vibehack itself. If you want to share or back up your custom extensions, version-control this directory yourself (`git init`), or copy specific files into your fork of pi-vibehack to ship them as defaults.
