import { promises as fs } from "node:fs";
import { join } from "node:path";
import { engagementDir } from "./engagement.ts";

// Stores the handoff for the next subprocess spawn so before_agent_start can pick it up.
export function pendingHandoffPath(engagementId: string): string {
  return join(engagementDir(engagementId), ".pending-handoff");
}

export async function setPendingHandoff(engagementId: string, body: string): Promise<void> {
  if (!body.trim()) return;
  await fs.mkdir(engagementDir(engagementId), { recursive: true });
  await fs.writeFile(pendingHandoffPath(engagementId), body, "utf8");
}

export async function consumePendingHandoff(engagementId: string): Promise<string> {
  try {
    const body = await fs.readFile(pendingHandoffPath(engagementId), "utf8");
    await fs.unlink(pendingHandoffPath(engagementId)).catch(() => {});
    return body;
  } catch { return ""; }
}
