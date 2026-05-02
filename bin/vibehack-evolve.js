#!/usr/bin/env node
// Run a bench via Layer A evolve. Phase 7: --mutate is parsed but currently a no-op (Phase 8 implements).
import { fileURLToPath } from "url";
import * as path from "path";
import * as fs from "fs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");

function parseArgs(argv) {
  const args = { bench: null, mutate: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--bench" && i + 1 < argv.length) { args.bench = argv[++i]; }
    else if (a === "--mutate") { args.mutate = true; }
    else if (a === "--help" || a === "-h") {
      console.log("usage: vibehack-evolve --bench <name> [--mutate]");
      process.exit(0);
    }
  }
  return args;
}

const { bench, mutate } = parseArgs(process.argv);
if (!bench) {
  console.error("error: --bench <name> is required");
  process.exit(2);
}

const benchDir = path.resolve(REPO_ROOT, "bench", bench);
if (!fs.existsSync(benchDir)) {
  console.error(`error: bench directory not found: ${benchDir}`);
  process.exit(2);
}

const evolve = await import(path.resolve(REPO_ROOT, "extensions/pi-vibehack/lib/evolve.ts"));

// Phase 7: stub engagement runner (returns empty findings) — actual engagement spawn comes in Phase 8 / dogfood
const stubEngagement = async (target) => {
  console.log(`[vibehack-evolve] Phase 7: stub engagement against ${target}`);
  console.log(`[vibehack-evolve] (real engagement spawn lands in Phase 8 — for now, this is a smoke test)`);
  return [];
};

try {
  const result = await evolve.runBench({ benchDir, runEngagement: stubEngagement, mutate });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
} catch (e) {
  console.error(`bench failed: ${e.message}`);
  process.exit(1);
}
