import { activeEngagementId } from "../lib/engagement.ts";
import { renderEngagement } from "../render/render-engagement.ts";

export async function buildStatusLine(): Promise<string> {
  const eng = await activeEngagementId();
  if (!eng) return "🌳 pi-vibehack ready · no engagement";
  try {
    const { nodeCount, confirmedCount, totalCost } = await renderEngagement(eng);
    return `🌳 ${nodeCount} nodes · ${confirmedCount} confirmed · $${totalCost.toFixed(3)} · /vibehack-tree`;
  } catch {
    return `🌳 pi-vibehack · engagement=${eng}`;
  }
}

export function registerStatusBanner(pi: any) {
  pi.registerFooter?.({
    name: "vibehack-status",
    render: async () => buildStatusLine(),
  });
}
