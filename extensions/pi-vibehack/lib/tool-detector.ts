// PATH-presence detection for the bug-bounty tool catalogue (v1.3).
//
// Runs once per session_start and caches the answers. We resolve the binary
// using `where` on Windows or `which` on POSIX, so the same code path works in
// Kali, WSL, mac, and stock Windows. Detection failures don't block anything;
// the catalogue is exposed regardless and the Planner can choose to install on
// demand.

import { spawnSync } from "node:child_process";
import { TOOL_CATALOG } from "../data/tool-catalog.ts";

let _cache: Record<string, boolean> | null = null;

function isWindows(): boolean { return process.platform === "win32"; }

export function detectBinary(bin: string): boolean {
  const cmd = isWindows() ? "where" : "which";
  try {
    const r = spawnSync(cmd, [bin], { stdio: "pipe", timeout: 2000 });
    if (r.error) return false;
    if (typeof r.status === "number" && r.status !== 0) return false;
    return (r.stdout?.toString().trim().length ?? 0) > 0;
  } catch {
    return false;
  }
}

export function detectAllTools(): Record<string, boolean> {
  if (_cache) return _cache;
  const out: Record<string, boolean> = {};
  for (const t of TOOL_CATALOG) {
    out[t.name] = detectBinary(t.bin);
  }
  _cache = out;
  return out;
}

export function isToolAvailable(name: string): boolean {
  const cache = _cache ?? detectAllTools();
  return cache[name] ?? false;
}

export function resetToolCache(): void { _cache = null; }
