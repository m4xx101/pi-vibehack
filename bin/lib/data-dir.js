import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function vibehackDir(custom) {
  return custom ?? join(homedir(), ".pi", "agent", "vibehack");
}

export async function ensureDataDir(dir) {
  const subs = ["", "engagements", "graph", "tools", "specialists/learned"];
  for (const s of subs) await fs.mkdir(join(dir, s), { recursive: true });
  for (const f of ["lessons.jsonl", "AGENTS.md"]) {
    const p = join(dir, f);
    try { await fs.access(p); } catch { await fs.writeFile(p, "", "utf8"); }
  }
}

export async function writeProfile(dir, resolved) {
  await fs.writeFile(join(dir, ".profile"), JSON.stringify(resolved, null, 2) + "\n", "utf8");
}

/**
 * Read and parse <dir>/.profile. Returns null on missing file (silent — first-run case).
 * On other errors (parse error, permission, etc.) emits a single console.warn so the
 * caller doesn't silently overwrite a recoverable-but-corrupt profile.
 */
export async function readProfile(dir) {
  const p = join(dir, ".profile");
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch (e) {
    if (e && e.code === "ENOENT") return null;
    console.warn(`pi-vibehack: ignoring unreadable .profile at ${p} (${e?.message ?? e})`);
    return null;
  }
}
