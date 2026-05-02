import { execFileSync } from "child_process";

const NPM_PKG_RE = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

export interface SoftDep {
  name: string;
  pkg: string;
  category: "http-probe" | "browser" | "recall" | "mcp" | "pi-extension";
  detect: string;
}

export const KNOWN_SOFT_DEPS: SoftDep[] = [
  { name: "pi-super-curl",  pkg: "pi-super-curl",           category: "http-probe",   detect: "pi-super-curl" },
  { name: "surf-cli",       pkg: "surf-cli",                category: "browser",      detect: "surf-cli" },
  { name: "playwright",     pkg: "playwright",              category: "browser",      detect: "playwright" },
  { name: "graphify",       pkg: "graphify",                category: "recall",       detect: "graphify" },
  { name: "pi-mcp-adapter", pkg: "pi-mcp-adapter",          category: "mcp",          detect: "pi-mcp-adapter" },
  { name: "memory-mode",    pkg: "@nicobailon/memory-mode", category: "pi-extension", detect: "memory-mode" },
  { name: "handoff",        pkg: "@nicobailon/handoff",     category: "pi-extension", detect: "pi-handoff" },
];

export interface DetectOpts { which?: (cmd: string) => string | null; }

function defaultWhich(cmd: string): string | null {
  try {
    const tool = process.platform === "win32" ? "where" : "which";
    const out = execFileSync(tool, [cmd], { stdio: ["ignore","pipe","ignore"] }).toString().trim();
    return out || null;
  } catch { return null; }
}

export function detectMissingSoftDeps(opts: DetectOpts = {}): SoftDep[] {
  const which = opts.which ?? defaultWhich;
  return KNOWN_SOFT_DEPS.filter(d => !which(d.detect));
}

export function fallbackFor(category: string): string[] {
  switch (category) {
    case "http-probe": return ["super-curl","curl","fail"];
    case "browser":    return ["surf-cli","playwright","raw-cdp","fail"];
    case "recall":     return ["graphify","grep-events","no-recall"];
    case "mcp":        return ["pi-mcp-adapter","direct-mcp","fail"];
    default:           return ["fail"];
  }
}

export function installNpmGlobal(pkg: string): { ok: boolean; error?: string } {
  if (!NPM_PKG_RE.test(pkg)) return { ok: false, error: `invalid pkg name: ${pkg}` };
  try { execFileSync("npm", ["install", "-g", pkg], { stdio: "pipe" }); return { ok: true }; }
  catch (e) { return { ok: false, error: (e as Error).message }; }
}

export interface PromptOpts { ask: (q: string) => Promise<string>; }
export interface PromptResult { installed: string[]; declined: string[]; skipped: boolean; }

export async function promptInstall(deps: SoftDep[], opts: PromptOpts): Promise<PromptResult> {
  if (deps.length === 0) return { installed: [], declined: [], skipped: false };
  const list = deps.map(d => d.name).join(", ");
  const ans = (await opts.ask(`💡 detected missing soft deps: ${list}\n   Install all? (Y/n/individual/skip-this-session): `)).toLowerCase().trim();
  if (ans === "s" || ans === "skip" || ans === "skip-this-session") return { installed: [], declined: [], skipped: true };
  if (ans === "n" || ans === "no") return { installed: [], declined: deps.map(d => d.name), skipped: false };
  if (ans === "i" || ans === "individual") {
    const installed: string[] = []; const declined: string[] = [];
    for (const dep of deps) {
      const a = (await opts.ask(`  install ${dep.name}? (y/n): `)).toLowerCase().trim();
      if (a === "y" || a === "" || a === "yes") {
        if (installNpmGlobal(dep.pkg).ok) installed.push(dep.name); else declined.push(dep.name);
      } else declined.push(dep.name);
    }
    return { installed, declined, skipped: false };
  }
  // default = yes-all
  const installed: string[] = []; const declined: string[] = [];
  for (const dep of deps) {
    if (installNpmGlobal(dep.pkg).ok) installed.push(dep.name); else declined.push(dep.name);
  }
  return { installed, declined, skipped: false };
}
