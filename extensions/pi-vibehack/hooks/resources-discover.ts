// resources_discover hook — surfaces EXTRA, per-session resources to pi-mono.
//
// IMPORTANT: bundled prompts/ and skills/ are declared in package.json#pi
// (extensions/skills/prompts arrays). pi-mono's resource loader picks those
// up from the package manifest at extension scan time. Returning the SAME
// paths from this hook causes "[Prompt conflicts] ... (skipped)" warnings on
// every boot — pi sees the same prompt registered twice and dedupes noisily.
//
// So this hook returns ONLY paths that aren't in the package manifest:
//   • per-engagement specialist prompts (engagements/<id>/prompts/) if present
//   • user-pinned global prompts (~/.pi/agent/vibehack/prompts/) if present
//
// Empty arrays are fine — pi-mono treats {skillPaths:[], promptPaths:[]} as a
// no-op rather than a complaint.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "../lib/typed-pi.ts";
import { activeEngagementId, engagementDir, vibehackRoot } from "../lib/engagement.ts";

async function dirExists(p: string): Promise<boolean> {
  try { const st = await fs.stat(p); return st.isDirectory(); } catch { return false; }
}

export async function computeResourcePaths(): Promise<{ skillPaths: string[]; promptPaths: string[] }> {
  const promptPaths: string[] = [];
  const skillPaths: string[] = [];

  // Per-engagement extras
  try {
    const eng = await activeEngagementId();
    if (eng) {
      const engPrompts = join(engagementDir(eng), "prompts");
      const engSkills = join(engagementDir(eng), "skills");
      if (await dirExists(engPrompts)) promptPaths.push(engPrompts);
      if (await dirExists(engSkills)) skillPaths.push(engSkills);
    }
  } catch {}

  // Operator-pinned globals (live alongside vibehack data dir, NOT the package)
  try {
    const root = vibehackRoot() || join(homedir(), ".pi", "agent", "vibehack");
    const userPrompts = join(root, "prompts");
    const userSkills = join(root, "skills");
    if (await dirExists(userPrompts)) promptPaths.push(userPrompts);
    if (await dirExists(userSkills)) skillPaths.push(userSkills);
  } catch {}

  return { skillPaths, promptPaths };
}

export function registerResourcesDiscoverHook(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => {
    return await computeResourcePaths();
  });
}
