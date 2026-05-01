import { promises as fs } from "node:fs";
import { join } from "node:path";
import { engagementDir } from "../lib/engagement.ts";
import { readEvents } from "../lib/events.ts";
import { renderTreeMd } from "./tree-md.ts";
import { renderFindingsMd } from "./findings-md.ts";

export async function renderEngagement(
  engagementId: string,
): Promise<{ nodeCount: number; confirmedCount: number; totalCost: number }> {
  const dir = engagementDir(engagementId);
  const events = await readEvents(dir);
  const treeMd = renderTreeMd(events, engagementId);
  const findingsMd = renderFindingsMd(events, engagementId);
  await fs.writeFile(join(dir, "tree.md"), treeMd, "utf8");
  await fs.writeFile(join(dir, "findings.md"), findingsMd, "utf8");

  let nodeCount = 0;
  let confirmedCount = 0;
  let totalCost = 0;
  for (const e of events) {
    if (e.event === "node_add") nodeCount++;
    if (e.event === "confirm") confirmedCount++;
    totalCost += (e as { cost_usd?: number }).cost_usd ?? 0;
  }
  return { nodeCount, confirmedCount, totalCost };
}
