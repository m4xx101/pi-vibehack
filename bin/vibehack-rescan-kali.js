#!/usr/bin/env node
// vibehack-rescan-kali: force-rescan Kali tool capabilities; refreshes
// ~/.pi/agent/vibehack/.capabilities.json. Resolves the lib path relative to
// this script's own location via import.meta.url so it runs from any CWD.

import { fileURLToPath, pathToFileURL } from "node:url";
import * as path from "node:path";
import * as os from "node:os";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const KALI_MOD = pathToFileURL(
  path.resolve(REPO_ROOT, "extensions", "pi-vibehack", "lib", "kali-tools.ts"),
).href;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: vibehack-rescan-kali");
  console.log("");
  console.log("  Probe PATH for all curated Kali tools and refresh");
  console.log("  ~/.pi/agent/vibehack/.capabilities.json.");
  process.exit(0);
}

const k = await import(KALI_MOD);

const capPath = path.join(os.homedir(), ".pi", "agent", "vibehack", ".capabilities.json");
const caps = k.detectKaliCapabilities();
k.saveCachedCapabilities(capPath, caps);

const availableCount = Object.values(caps).filter((c) => c.available).length;
const totalCount = Object.keys(caps).length;
console.log(`Rescanned: ${availableCount}/${totalCount} tools available on PATH`);
console.log(`Cache: ${capPath}`);
