import { promises as fs } from "node:fs";
import { join } from "node:path";
import { engagementDir } from "./engagement.ts";

export function pendingSteerPath(engagementId: string): string {
  return join(engagementDir(engagementId), ".pending-steer");
}

export async function appendSteer(engagementId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  await fs.mkdir(engagementDir(engagementId), { recursive: true });
  const stamped = `[${new Date().toISOString()}] ${text.trim()}\n`;
  await fs.appendFile(pendingSteerPath(engagementId), stamped, "utf8");
}

export async function consumeSteer(engagementId: string): Promise<string> {
  try {
    const body = await fs.readFile(pendingSteerPath(engagementId), "utf8");
    await fs.unlink(pendingSteerPath(engagementId)).catch(() => {});
    return body;
  } catch { return ""; }
}
