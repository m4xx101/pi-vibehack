import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { readEvents } from "../lib/events.ts";
import { foldNodes } from "../render/tree-md.ts";
import { recall } from "../graph/recall.ts";
import { getDetected } from "../lib/detector-cache.ts";
import type { SkillInfo } from "../lib/extension-detector.ts";
import type { ExtensionAPI, ExtensionContext, BeforeProviderRequestEvent } from "../lib/typed-pi.ts";

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

export function formatRecallBlock(subs: any[], recipeHints?: SkillInfo[]): string {
  const hasSubs = subs && subs.length > 0;
  const hasHints = recipeHints && recipeHints.length > 0;
  if (!hasSubs && !hasHints) return "";
  const lines: string[] = ["<recall>"];
  if (hasSubs) {
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
  }
  if (hasHints) {
    lines.push("Operator has these skills available as recipe_hints:");
    for (const s of recipeHints!) {
      lines.push(`- \`${s.name}\`${s.description ? ` — ${s.description}` : ""}`);
    }
    lines.push("");
  }
  lines.push("</recall>");
  return lines.join("\n");
}

export function registerBeforeProviderRequestHook(pi: ExtensionAPI) {
  pi.on("before_provider_request", async (event: BeforeProviderRequestEvent, _ctx: ExtensionContext) => {
    try {
      const eng = await activeEngagementId();
      if (!eng) return;
      const events = await readEvents(engagementDir(eng));
      const query = pickOpenHypothesisQuery(events);
      if (!query) return;
      const subs = await recall(query);
      const detected = getDetected();
      const recipeHints = detected?.skills;
      const block = formatRecallBlock(subs, recipeHints);
      if (!block) return;
      // event.payload is `unknown` per the typed API — providers serialize
      // their request payload in their own shape. Narrow with runtime checks
      // and cast locally to mutate either OpenAI-style messages[] or the
      // Anthropic-style top-level system string.
      const payload = event.payload as { messages?: unknown; system?: unknown } | null | undefined;
      if (Array.isArray(payload?.messages)) {
        (payload as any).messages = [
          { role: "system", content: block },
          ...(payload!.messages as unknown[]),
        ];
      } else if (typeof payload?.system === "string") {
        (payload as any).system = block + "\n\n" + payload.system;
      }
    } catch {
      /* never break the request */
    }
  });
}
