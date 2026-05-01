import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { readEvents } from "../lib/events.ts";
import { foldNodes } from "../render/tree-md.ts";
import { recall } from "../graph/recall.ts";

export function pickOpenHypothesisQuery(events: any[]): string | null {
  const nodes = foldNodes(events);
  const open = [...nodes.values()].filter(
    (n) => n.status === "open" || n.status === "in-flight",
  );
  if (open.length === 0) return null;
  const score = (n: any) =>
    (n.kind === "leaf" ? 3 : n.kind === "hypothesis" ? 2 : 1) +
    (n.confidence ?? 0);
  const ranked = open.sort((a, b) => score(b) - score(a));
  const top = ranked[0];
  return top.claim;
}

export function formatRecallBlock(subs: any[]): string {
  if (!subs || subs.length === 0) return "";
  const lines: string[] = ["<recall>"];
  lines.push(
    "Related prior knowledge from cross-engagement graph (auto-injected):",
  );
  lines.push("");
  for (let i = 0; i < subs.length; i++) {
    const s = subs[i];
    lines.push(`${i + 1}. From ${s.source}:`);
    for (const e of (s.entities ?? []).slice(0, 5)) {
      lines.push(`   - ${e.kind}: ${e.label}`);
    }
    for (const ed of (s.edges ?? []).slice(0, 5)) {
      lines.push(`   - ${ed.type}: ${ed.from} → ${ed.to}`);
    }
    for (const n of (s.notes ?? []).slice(0, 3)) {
      lines.push(`   - ${n}`);
    }
    lines.push("");
  }
  lines.push("</recall>");
  return lines.join("\n");
}

export function registerBeforeProviderRequestHook(pi: any) {
  pi.on("before_provider_request", async (event: any, _ctx: any) => {
    try {
      const eng = await activeEngagementId();
      if (!eng) return;
      const events = await readEvents(engagementDir(eng));
      const query = pickOpenHypothesisQuery(events);
      if (!query) return;
      const subs = await recall(query);
      const block = formatRecallBlock(subs);
      if (!block) return;
      if (Array.isArray(event?.payload?.messages)) {
        event.payload.messages = [
          { role: "system", content: block },
          ...event.payload.messages,
        ];
      } else if (typeof event?.payload?.system === "string") {
        event.payload.system = block + "\n\n" + event.payload.system;
      }
    } catch {
      /* never break the request */
    }
  });
}
