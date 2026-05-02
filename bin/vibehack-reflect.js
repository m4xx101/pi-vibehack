#!/usr/bin/env node
// vibehack-reflect: manually invoke the reflection loop for the active
// engagement (Layer B). Cluster confirmed leaves and write refined recipes
// into ~/.pi/agent/vibehack/skills/learned/.
//
// Resolves the extensions/lib path relative to this script's own location via
// import.meta.url so it runs from any CWD.

import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REFLECTION_MOD = path.resolve(HERE, "..", "extensions", "pi-vibehack", "lib", "reflection.ts");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: vibehack-reflect [--engagement <id>]");
  console.log("");
  console.log("  Cluster confirmed leaves from the active engagement's events.jsonl");
  console.log("  and write refined recipes into ~/.pi/agent/vibehack/skills/learned/.");
  console.log("  Override the engagement via --engagement or VIBEHACK_ENGAGEMENT_ID.");
  process.exit(0);
}

const VIBEHACK_ROOT = process.env.VIBEHACK_DATA_DIR ?? path.join(os.homedir(), ".pi", "agent", "vibehack");

function resolveEngagementId() {
  const argIdx = process.argv.indexOf("--engagement");
  if (argIdx >= 0 && process.argv[argIdx + 1]) return process.argv[argIdx + 1];
  if (process.env.VIBEHACK_ENGAGEMENT_ID) return process.env.VIBEHACK_ENGAGEMENT_ID;
  // Fall back to .active marker.
  const marker = path.join(VIBEHACK_ROOT, ".active");
  try { return fs.readFileSync(marker, "utf8").trim() || null; }
  catch { return null; }
}

const engagementId = resolveEngagementId();
if (!engagementId) {
  console.error("vibehack-reflect: no active engagement (no .active marker, no --engagement, no $VIBEHACK_ENGAGEMENT_ID)");
  process.exit(2);
}

const eventsPath = path.join(VIBEHACK_ROOT, "engagements", engagementId, "events.jsonl");
const learnedDir = path.join(VIBEHACK_ROOT, "skills", "learned");

if (!fs.existsSync(eventsPath)) {
  console.error(`vibehack-reflect: events.jsonl not found at ${eventsPath}`);
  process.exit(3);
}

const mod = await import(REFLECTION_MOD);
const result = await mod.runReflection({ eventsPath, learnedDir, scope: "manual" });

console.log(JSON.stringify({
  engagement_id: engagementId,
  written_skills: result.writtenSkills,
  written_specialists: result.writtenSpecialists,
  count: result.writtenSkills.length,
}, null, 2));
