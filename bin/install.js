#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { addPackage, removePackage } from "./lib/settings.js";
import { resolveProfile } from "./lib/profile.js";
import { vibehackDir, ensureDataDir, writeProfile } from "./lib/data-dir.js";

async function verifyPiInstalled() {
  return await new Promise((resolve) => {
    const c = spawn(process.platform === "win32" ? "where" : "which", ["pi"], { stdio: "ignore" });
    c.on("error", () => resolve(false));
    c.on("close", (code) => resolve(code === 0));
  });
}

const PKG = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { args[key] = next; i++; }
      else args[key] = true;
    } else args._.push(a);
  }
  return args;
}

function resolveSettingsPath(args) {
  return args.local
    ? join(process.cwd(), ".pi", "settings.json")
    : join(homedir(), ".pi", "agent", "settings.json");
}

async function cmdInstall(args) {
  if (!(await verifyPiInstalled())) {
    console.error("✗ pi (pi-mono) is not on PATH.");
    console.error("  Install: npm i -g @mariozechner/pi-coding-agent");
    console.error("  Then re-run this installer.");
    process.exit(2);
  }
  const settingsPath = resolveSettingsPath(args);

  const profile = resolveProfile({
    profile: args.profile,
    planner: args.planner,
    operator: args.operator,
    reporter: args.reporter,
  });

  await addPackage(settingsPath, `npm:${PKG.name}@${PKG.version}`);
  await addPackage(settingsPath, "npm:pi-prompt-template-model@^0.9.0");
  await addPackage(settingsPath, "npm:@zenobius/pi-dcp@^0.1.0");

  const dataDir = vibehackDir(args["data-dir"]);
  await ensureDataDir(dataDir);
  await writeProfile(dataDir, profile);

  console.log(`✓ ${PKG.name}@${PKG.version} installed`);
  console.log(`✓ settings.json patched: ${settingsPath}`);
  console.log(`✓ data dir: ${dataDir}`);
  console.log(`✓ profile: ${profile.profile} (planner=${profile.planner} operator=${profile.operator} reporter=${profile.reporter})`);
  // Soft-dep install hints (advisory only at install time; runtime detection lives in
  // session_start banners — see Task 27.10).
  console.log(`💡 install pi-super-curl for HTTP/auth power-ups: npm i -g pi-super-curl`);
  console.log(`💡 install surf-cli for browser automation: npm i -g surf-cli`);
  console.log(`Restart pi or /reload. Run /vibehack <target> to start.`);
  console.log(`\n⚠️  AUTHORIZED TESTING ONLY.`);
  console.log(`   The operator is responsible for authorization.`);
  console.log(`   Do not use against systems you do not own or have explicit written permission to test.\n`);
}

async function cmdUninstall(args) {
  const settingsPath = resolveSettingsPath(args);
  const dataDir = vibehackDir(args["data-dir"]);
  await removePackage(settingsPath, /^npm:@m4xx101\/pi-vibehack/);
  console.log(`✓ removed ${PKG.name} from ${settingsPath}`);
  console.log(`(engagement data preserved at ${dataDir})`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] ?? "install";
try {
  if (cmd === "install") await cmdInstall(args);
  else if (cmd === "uninstall") await cmdUninstall(args);
  else { console.error(`unknown command: ${cmd}`); process.exit(2); }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
