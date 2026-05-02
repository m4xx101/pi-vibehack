import { activeEngagementId } from "../lib/engagement.ts";
import { renderEngagement } from "../render/render-engagement.ts";
import { readEvents } from "../lib/events.ts";
import { engagementDir } from "../lib/engagement.ts";
import { readConfig } from "../lib/config-runtime.ts";
import { join } from "node:path";
import { homedir } from "node:os";

export interface BannerEvent {
  type?: string;
  event?: string;
  cost_usd?: number;
  ts?: string;
  [k: string]: any;
}

export interface BannerOpts {
  events: BannerEvent[];
  treeNodes: number;
  confirmed: number;
  config?: { ui?: { banner?: { show_last_turn_cost?: boolean; show_engagement_cost?: boolean; cost_warn_threshold_usd?: number } } };
}

export function renderStatusBanner(opts: BannerOpts): string {
  const banner = opts.config?.ui?.banner;
  const showLast = banner?.show_last_turn_cost ?? true;
  const showEng = banner?.show_engagement_cost ?? true;
  const threshold = banner?.cost_warn_threshold_usd ?? 0.5;

  const costs = opts.events.filter(
    (e) => (e.type === "tool_result" || e.event === "tool_result") && typeof e.cost_usd === "number",
  );
  const engagementCost = costs.reduce((s, e) => s + (e.cost_usd ?? 0), 0);
  const lastTurnCost = costs.length ? (costs[costs.length - 1].cost_usd ?? 0) : 0;

  const parts: string[] = [`🌳 ${opts.treeNodes} nodes · ${opts.confirmed} confirmed`];

  if (showLast && costs.length > 0) {
    const formatted = `$${lastTurnCost.toFixed(2)}`;
    const segment = `⚡ ${formatted} (last turn)`;
    parts.push(lastTurnCost > threshold ? `[31m${segment}[0m` : segment);
  }
  if (showEng && costs.length > 0) {
    parts.push(`💰 $${engagementCost.toFixed(2)} (eng)`);
  }
  parts.push("/vibehack-tree");
  return parts.join(" · ");
}

export async function buildStatusLine(): Promise<string> {
  const eng = await activeEngagementId();
  if (!eng) return "🌳 pi-vibehack ready · no engagement";
  try {
    const { nodeCount, confirmedCount } = await renderEngagement(eng);
    const dir = engagementDir(eng);
    const events = await readEvents(dir);
    let config: any = null;
    try {
      config = readConfig(join(homedir(), ".pi", "agent", "vibehack", "config.yaml"));
    } catch {
      config = null;
    }
    return renderStatusBanner({
      events: events as BannerEvent[],
      treeNodes: nodeCount,
      confirmed: confirmedCount,
      config: config ?? undefined,
    });
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
