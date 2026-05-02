import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PROFILE_TEMPLATES } from "./profile.js";
import { readConfig } from "./config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROMPTS_DIR = join(HERE, "..", "..", "prompts");

const ROLE_PROMPTS = {
  planner: ["vibehack.md", "vibehack-pause.md", "vibehack-resume.md", "expand.md", "prune.md", "steer.md", "vibehack-distill.md", "vibehack-pin.md", "vibehack-handoff.md", "vibehack-chain-reject.md"],
  operator: ["confirm.md", "vibehack-chain-confirm.md", "vibehack-ingest.md"],
  reporter: ["vibehack-complete.md"],
};

/**
 * Rewrite the `model:` frontmatter line of role-grouped prompts.
 *
 * Two call shapes for backward compat:
 *   1. rewritePromptsForProfile({ planner, operator, reporter })   — resolved-profile object (legacy)
 *   2. rewritePromptsForProfile("hybrid", { configPath, promptsDir })  — read from config.yaml when present
 *
 * Prompts NOT in any role group (e.g., vibehack-tree.md) are never modified.
 */
export async function rewritePromptsForProfile(profileOrResolved, opts = {}) {
  let assignments;
  let promptsDir = opts.promptsDir ?? DEFAULT_PROMPTS_DIR;

  if (typeof profileOrResolved === "string") {
    // New shape: resolve from config.yaml if present, else fall back to PROFILE_TEMPLATES.
    const cfg = opts.configPath ? readConfig(opts.configPath) : null;
    if (cfg && cfg.models) {
      assignments = {
        planner: cfg.models.planner,
        operator: cfg.models.operator,
        reporter: cfg.models.reporter,
      };
    } else {
      const tmpl = PROFILE_TEMPLATES[profileOrResolved] ?? PROFILE_TEMPLATES.hybrid;
      assignments = { planner: tmpl.planner, operator: tmpl.operator, reporter: tmpl.reporter };
    }
  } else {
    // Legacy shape: resolved-profile object passed directly.
    assignments = profileOrResolved ?? {};
  }

  for (const [role, files] of Object.entries(ROLE_PROMPTS)) {
    const model = assignments[role];
    if (!model) continue;
    for (const f of files) {
      const path = join(promptsDir, f);
      let body;
      try { body = await fs.readFile(path, "utf8"); } catch { continue; }
      body = body.replace(/^(---[\s\S]*?\nmodel:\s*)([^\n]+)/m, `$1${model}`);
      await fs.writeFile(path, body, "utf8");
    }
  }
}
