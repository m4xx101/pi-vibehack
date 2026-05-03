#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { addPackage, removePackage } from "./lib/settings.js";
import { resolveProfile } from "./lib/profile.js";
import { vibehackDir, ensureDataDir, writeProfile } from "./lib/data-dir.js";
import { defaultConfig, writeConfig } from "./lib/config.js";

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

// Detect-and-retry wrapper for any future subprocess install path. Mirrors the
// install.sh logic: on failure, scan stderr for the @stacksjs/clarity bunx
// git-hooks postinstall signature; if matched, retry once with --ignore-scripts
// (safe — only skips dev-time git-hooks setup, not runtime code).
//
// Currently bin/install.js does NOT spawn npm install for pi-mono or soft-deps:
// pi-mono is verified on PATH (operator installs it manually or via install.sh),
// soft-deps are surfaced as advisory `💡 install ...` hints, and the harness
// packages are registered via addPackage() into settings.json (pi-mono itself
// performs the lazy install when it reads settings). This helper is exported
// so any future spawn site can adopt the same UX without re-deriving it.
export async function npmInstallWithRetry(args, opts = {}) {
  const { spawn } = await import("node:child_process");
  const log = [];
  const run = (extra = []) => new Promise((resolve) => {
    const c = spawn("npm", [...args.slice(0, 1), ...extra, ...args.slice(1)], {
      stdio: ["ignore", "inherit", "pipe"],
      shell: process.platform === "win32",
    });
    c.stderr.on("data", (b) => { const s = b.toString(); log.push(s); process.stderr.write(s); });
    c.on("error", () => resolve(1));
    c.on("close", (code) => resolve(code ?? 1));
  });
  const code = await run();
  if (code === 0) return 0;
  const stderr = log.join("");
  if (/git-hooks|@stacksjs\/clarity|postinstall/.test(stderr)) {
    console.error("⚠ npm install failed due to a known transitive postinstall (bunx git-hooks / @stacksjs/clarity).");
    console.error("  Retrying with --ignore-scripts...");
    log.length = 0;
    return await run(["--ignore-scripts"]);
  }
  return code;
}

// Always-run preflight: globally install @zenobius/pi-dcp with --ignore-scripts
// so pi-mono's lazy install at boot is a no-op.
//
// CRITICAL: pi-mono's needs-install check (dist/core/package-manager.js
// `installedNpmMatchesPinnedVersion`) uses STRING EQUALITY between the spec's
// version literal and the on-disk package.json "version". Pinning a semver range
// like "^0.1.0" means the equality NEVER holds against the resolved version
// "0.1.3", so pi-mono re-runs `npm install -g <pkg>@^0.1.0` on every boot,
// re-triggering the broken @stacksjs/clarity bunx-git-hooks postinstall.
//
// FIX: after preflight, read the EXACT resolved version from disk and pin
// settings.json to `npm:@zenobius/pi-dcp@<exact>`. pi-mono's equality check
// then succeeds; lazy install is skipped; postinstall never runs.
async function preflightPiDcp(settingsPath) {
  console.log(`→ preflight: installing @zenobius/pi-dcp (with --ignore-scripts to bypass upstream postinstall bug)...`);
  const { spawn } = await import("node:child_process");
  const log = [];
  const code = await new Promise((resolve) => {
    const c = spawn("npm", ["install", "-g", "@zenobius/pi-dcp@^0.1.0", "--ignore-scripts"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    c.stdout.on("data", (b) => log.push(b.toString()));
    c.stderr.on("data", (b) => log.push(b.toString()));
    c.on("error", () => resolve(1));
    c.on("close", (rc) => resolve(rc ?? 1));
  });
  if (code !== 0) {
    console.warn(`⚠ pi-dcp preflight install failed (exit ${code}); pi will boot without Dynamic Context Pruning.`);
    console.warn(`  Logs: ${log.join("").split("\n").slice(-5).join("\n  ")}`);
    return;
  }

  // Resolve EXACT installed version so pi-mono's string-equality check passes.
  let exactVersion;
  try {
    const { execSync } = await import("node:child_process");
    const prefix = execSync("npm root -g", { encoding: "utf8" }).trim();
    const pkgJsonPath = join(prefix, "@zenobius", "pi-dcp", "package.json");
    const installed = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    exactVersion = installed.version;
  } catch (e) {
    console.warn(`⚠ pi-dcp installed but couldn't resolve exact version (${e.message}); falling back to range.`);
    await addPackage(settingsPath, "npm:@zenobius/pi-dcp@^0.1.0");
    return;
  }

  await addPackage(settingsPath, `npm:@zenobius/pi-dcp@${exactVersion}`);
  console.log(`✓ pi-dcp preflight succeeded; pinned exact ${exactVersion} in settings (skips pi-mono's lazy reinstall)`);
}

async function cmdInstall(args) {
  const dryRun = !!args["dry-run"];
  if (!dryRun && !(await verifyPiInstalled())) {
    console.error("✗ pi (pi-mono) is not on PATH.");
    console.error("  Install: npm i -g @mariozechner/pi-coding-agent");
    console.error("  If install fails with a `bunx git-hooks` error, retry with:");
    console.error("    npm i -g @mariozechner/pi-coding-agent --ignore-scripts");
    console.error("  See docs/TROUBLESHOOTING.md for details (incl. WSL PATH-shadowing).");
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

  // Write config.yaml (seed from profile templates, overlay explicit flags).
  const cfgOut = args["config-out"]
    ?? join(homedir(), ".pi", "agent", "vibehack", "config.yaml");
  const cfg = defaultConfig(profile.profile);
  cfg.models.planner = profile.planner;
  cfg.models.operator = profile.operator;
  cfg.models.reporter = profile.reporter;
  writeConfig(cfgOut, cfg);
  console.log(`✓ config written: ${cfgOut}`);

  if (dryRun) {
    console.log(`(dry-run: skipping settings.json + npm package registration)`);
    return;
  }

  await addPackage(settingsPath, `npm:${PKG.name}@${PKG.version}`);
  await addPackage(settingsPath, "npm:pi-prompt-template-model@^0.9.0");

  // @zenobius/pi-dcp's transitive @stacksjs/clarity has a broken postinstall
  // (`bunx git-hooks` ENOENT). pi-mono lazy-installs settings packages at boot
  // and would crash. Preflight-install pi-dcp globally with --ignore-scripts
  // FIRST — pi-mono's later spawn finds it cached and skips the postinstall.
  // No user flag, no decision, no opt-in. Just works.
  await preflightPiDcp(settingsPath);

  const dataDir = vibehackDir(args["data-dir"]);
  await ensureDataDir(dataDir);
  await writeProfile(dataDir, profile);

  const { rewritePromptsForProfile } = await import("./lib/rewrite-prompts.js");
  await rewritePromptsForProfile(profile);
  console.log(`✓ prompt frontmatter rewritten for profile=${profile.profile}`);

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

async function cmdUpdate(args) {
  // Self-update: pull the latest @m4xx101/vibeshack from npm, then re-run
  // install (idempotent). Preserves config.yaml, hand-edited prompt frontmatter,
  // and engagement data; refreshes the package, settings.json package pins,
  // soft-dep + Kali caches.
  console.log(`→ pulling latest @m4xx101/vibeshack from npm...`);
  const { spawn } = await import("node:child_process");
  const code = await new Promise((resolve) => {
    const c = spawn("npm", ["install", "-g", "@m4xx101/vibeshack@latest"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    c.on("error", () => resolve(1));
    c.on("close", (rc) => resolve(rc ?? 1));
  });
  if (code !== 0) {
    console.error(`✗ npm install failed (exit ${code}). Aborting update.`);
    process.exit(code);
  }
  console.log(`✓ package updated; re-running install (idempotent — preserves config + hand-edits)...\n`);

  // Re-exec the freshly-installed binary so the install logic that runs is the
  // NEW version's, not whatever this stale process loaded. spawn pi-vibehack
  // (now points at the new package) with `install` and forward all flags.
  const re = spawn("pi-vibehack", ["install", ...process.argv.slice(3)], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  re.on("close", (rc) => process.exit(rc ?? 0));
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
  else if (cmd === "update") await cmdUpdate(args);
  else if (cmd === "uninstall") await cmdUninstall(args);
  else if (cmd === "--version" || cmd === "-v") { console.log(PKG.version); }
  else { console.error(`unknown command: ${cmd}\nUsage: pi-vibehack [install|update|uninstall|--version]`); process.exit(2); }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
