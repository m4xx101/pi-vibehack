import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { vibehackRoot } from "./engagement.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIPPED_DIR = join(HERE, "..", "..", "..", "skills", "specialists");

export async function loadSpecialist(kind: string): Promise<string | null> {
  // Try shipped first
  const shippedPath = join(SHIPPED_DIR, kind, "SKILL.md");
  try { return await fs.readFile(shippedPath, "utf8"); } catch {}
  // Then operator-grown
  const learnedPath = join(vibehackRoot(), "specialists", "learned", kind, "SKILL.md");
  try { return await fs.readFile(learnedPath, "utf8"); } catch {}
  return null;
}

export async function listAvailableSpecialists(): Promise<string[]> {
  const out = new Set<string>();
  try { for (const d of await fs.readdir(SHIPPED_DIR)) out.add(d); } catch {}
  try { for (const d of await fs.readdir(join(vibehackRoot(), "specialists", "learned"))) out.add(d); } catch {}
  return [...out].sort();
}
