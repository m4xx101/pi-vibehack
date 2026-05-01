import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function vibehackRoot(): string {
  return process.env.VIBEHACK_DATA_DIR ?? join(homedir(), ".pi", "agent", "vibehack");
}

export function engagementsRoot(): string {
  return join(vibehackRoot(), "engagements");
}

export function engagementDir(engagementId: string): string {
  return join(engagementsRoot(), engagementId);
}

export async function activeEngagementId(): Promise<string | null> {
  const marker = join(vibehackRoot(), ".active");
  try { return (await fs.readFile(marker, "utf8")).trim() || null; }
  catch { return null; }
}

export async function setActiveEngagement(id: string | null): Promise<void> {
  const marker = join(vibehackRoot(), ".active");
  if (id === null) {
    try { await fs.unlink(marker); } catch {}
  } else {
    await fs.mkdir(vibehackRoot(), { recursive: true });
    await fs.writeFile(marker, id, "utf8");
  }
}

export function slugify(target: string): string {
  return target.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export function newEngagementId(target: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${date}-${slugify(target)}`;
}
