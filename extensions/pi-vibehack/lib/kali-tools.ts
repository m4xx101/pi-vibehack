// Kali tool auto-discovery: curated catalog (~80 tools / 8 categories) + PATH
// detection + cache I/O. Used by session_start to populate
// ~/.pi/agent/vibehack/.capabilities.json and by /vibehack-rescan-kali to force
// a refresh. The planner consults the cache to decide which Kali recipes are
// available on the current host.

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export const KALI_TOOLS: Record<string, string[]> = {
  recon: [
    "nmap", "masscan", "subfinder", "amass", "assetfinder", "httpx", "nuclei",
    "ffuf", "gobuster", "dirb", "wfuzz", "feroxbuster", "katana", "gau",
    "waybackurls", "hakrawler", "subzy", "dnsrecon", "dnsenum", "fierce",
    "theharvester", "shodan", "censys", "spiderfoot",
  ],
  exploit: [
    "sqlmap", "metasploit-framework", "exploit-db", "searchsploit", "nikto",
    "wapiti", "skipfish", "wpscan", "joomscan", "droopescan", "burp-suite",
    "zaproxy", "ysoserial",
  ],
  crack: ["hashcat", "john", "hydra", "medusa", "patator", "cewl", "crunch"],
  forensic: [
    "binwalk", "volatility", "exiftool", "foremost", "scalpel", "strings",
    "objdump", "radare2", "ghidra",
  ],
  network: [
    "wireshark", "tcpdump", "tshark", "netcat", "socat", "responder",
    "impacket-tools", "crackmapexec", "evil-winrm",
  ],
  web_api: ["curl", "httpie", "jq", "yq"],
  mobile: ["apktool", "jadx", "frida", "objection"],
  misc: ["docker", "podman", "git", "go", "python3", "node"],
};

export interface CapEntry {
  path: string | null;
  category: string;
  available: boolean;
}

function defaultWhich(cmd: string): string | null {
  try {
    const tool = process.platform === "win32" ? "where" : "which";
    const out = execFileSync(tool, [cmd], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    // `where` may return multiple lines on Windows; take the first.
    const first = out.split(/\r?\n/)[0]?.trim() ?? "";
    return first || null;
  } catch {
    return null;
  }
}

export interface DetectOpts {
  which?: (cmd: string) => string | null;
}

export function detectKaliCapabilities(opts: DetectOpts = {}): Record<string, CapEntry> {
  const which = opts.which ?? defaultWhich;
  const out: Record<string, CapEntry> = {};
  for (const [category, tools] of Object.entries(KALI_TOOLS)) {
    for (const tool of tools) {
      const p = which(tool);
      out[tool] = { path: p, category, available: !!p };
    }
  }
  return out;
}

export function loadCachedCapabilities(filePath: string): Record<string, CapEntry> | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    // Accept both raw map and wrapped envelope { cached_at, capabilities }.
    if (data && typeof data === "object" && "capabilities" in data) {
      return data.capabilities as Record<string, CapEntry>;
    }
    return data as Record<string, CapEntry>;
  } catch {
    return null;
  }
}

export function saveCachedCapabilities(filePath: string, caps: Record<string, CapEntry>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ cached_at: new Date().toISOString(), capabilities: caps }, null, 2),
    "utf8",
  );
}

/**
 * Detect Kali-MCP soft companion presence (mcp-kali-server or zebbern-kali-mcp).
 * Returns the detected binary name or null. Used at session_start to surface a
 * banner; downstream tooling can register the MCP as a soft companion.
 */
export function detectKaliMcp(opts: DetectOpts = {}): string | null {
  const which = opts.which ?? defaultWhich;
  if (which("mcp-kali-server")) return "mcp-kali-server";
  if (which("zebbern-kali-mcp")) return "zebbern-kali-mcp";
  return null;
}

/**
 * Lookup a single tool: cache hit returns the cached entry; cache miss probes
 * PATH directly and updates the cache. Used for lazy refresh when the planner
 * asks for a tool that isn't in the catalog or wasn't seen at session_start.
 */
export function lookupTool(name: string, capPath: string, opts: DetectOpts = {}): CapEntry | null {
  const cached = loadCachedCapabilities(capPath);
  if (cached?.[name]) return cached[name];

  const which = opts.which ?? defaultWhich;
  const p = which(name);
  if (!p) return null;

  let category = "unknown";
  for (const [cat, tools] of Object.entries(KALI_TOOLS)) {
    if (tools.includes(name)) { category = cat; break; }
  }
  const entry: CapEntry = { path: p, category, available: true };

  const updated: Record<string, CapEntry> = cached ?? {};
  updated[name] = entry;
  try { saveCachedCapabilities(capPath, updated); } catch {}

  return entry;
}
