#!/usr/bin/env node
// vibehack-config-sync: regenerate prompt frontmatter from ~/.pi/agent/vibehack/config.yaml.
//
// Invoked by the /vibehack-config sync slash command. Runs from any CWD —
// resolves the prompts directory relative to this script's own location via
// import.meta.url (NOT process.cwd()).

import { fileURLToPath } from "node:url";
import * as path from "node:path";
import * as os from "node:os";
import { rewritePromptsForProfile } from "./lib/rewrite-prompts.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = path.resolve(HERE, "..", "prompts");
const CONFIG_PATH = path.join(os.homedir(), ".pi", "agent", "vibehack", "config.yaml");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: vibehack-config-sync [--profile <hybrid|local|frontier>]");
  console.log("");
  console.log(`  Reads ${CONFIG_PATH} (if present) and rewrites the`);
  console.log(`  model: frontmatter line of role-grouped prompts in ${PROMPTS_DIR}.`);
  console.log("  Falls back to the named profile when config.yaml is absent.");
  process.exit(0);
}

const profileIdx = process.argv.indexOf("--profile");
const profile = profileIdx >= 0 ? process.argv[profileIdx + 1] : "hybrid";

rewritePromptsForProfile(profile, { configPath: CONFIG_PATH, promptsDir: PROMPTS_DIR })
  .then(() => {
    console.log(`vibehack-config-sync: rewrote prompts in ${PROMPTS_DIR} (profile=${profile}, config=${CONFIG_PATH})`);
  })
  .catch((e) => {
    console.error(`vibehack-config-sync failed: ${e?.message ?? String(e)}`);
    process.exit(1);
  });
