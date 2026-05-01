import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(HERE, "..", "..", "prompts");

const ROLE_PROMPTS = {
  planner: ["vibehack.md", "vibehack-pause.md", "vibehack-resume.md", "expand.md", "prune.md", "steer.md", "vibehack-distill.md", "vibehack-pin.md", "vibehack-handoff.md", "vibehack-chain-reject.md"],
  operator: ["confirm.md", "vibehack-chain-confirm.md", "vibehack-ingest.md"],
  reporter: ["vibehack-complete.md"],
};

export async function rewritePromptsForProfile(resolved) {
  for (const [role, files] of Object.entries(ROLE_PROMPTS)) {
    const model = resolved[role];
    if (!model) continue;
    for (const f of files) {
      const path = join(PROMPTS_DIR, f);
      let body;
      try { body = await fs.readFile(path, "utf8"); } catch { continue; }
      body = body.replace(/^(---[\s\S]*?\nmodel:\s*)([^\n]+)/m, `$1${model}`);
      await fs.writeFile(path, body, "utf8");
    }
  }
}
