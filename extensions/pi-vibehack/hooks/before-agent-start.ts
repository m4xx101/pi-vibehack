import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { activeEngagementId, engagementDir, vibehackRoot } from "../lib/engagement.ts";
import { detectProvider, loadPersona } from "../lib/persona.ts";
import { PLANNER_TOOL_NAMES } from "../tools/index.ts";
import { startTurn } from "../lib/turn-state.ts";
import { getMutationGateMessage } from "./tool-result.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

const BROWSER_CLASS_KINDS = new Set([
  "DOM-XSS",
  "reflected-XSS",
  "stored-XSS",
  "open-redirect",
  "clickjacking",
  "postMessage-leak",
  "subdomain-takeover",
]);

export function buildVerificationAdvisory(events: any[]): string {
  const verified = new Set<string>();
  for (const e of events) {
    if (e?.event === "verification_pass" && typeof e.node_id === "string") {
      verified.add(e.node_id);
    }
  }
  const unverifiedConfirms = events.filter((e) =>
    e?.event === "confirm" &&
    BROWSER_CLASS_KINDS.has(e.kind) &&
    !verified.has(e.node_id)
  );
  if (unverifiedConfirms.length === 0) return "";

  const lines = unverifiedConfirms.map(
    (e) => `${e.node_id} confirmed as ${e.kind} but no browser verification ran.`
  );
  return [
    "<verification_advisory>",
    ...lines,
    `Either propose vibehack_propose_specialist(<node_id>, "browser-verifier") to verify in headless Chrome, or accept unverified (re-confirm via operator override).`,
    "</verification_advisory>",
  ].join("\n");
}

async function buildBoundsAdvisory(eng: string): Promise<string> {
  try {
    const { readEvents } = await import("../lib/events.ts");
    const { foldNodes } = await import("../render/tree-md.ts");
    const events = await readEvents(engagementDir(eng));
    const nodes = foldNodes(events);
    const warnings: string[] = [];
    const depthOf = (id: string): number => {
      let d = 0; let cur = nodes.get(id);
      while (cur && cur.parent_id) { d++; cur = nodes.get(cur.parent_id); }
      return d;
    };
    for (const n of nodes.values()) {
      if (n.status !== "open" && n.status !== "in-flight") continue;
      if (depthOf(n.node_id) >= 6) warnings.push(`node ${n.node_id} at depth 6 — prune or confirm`);
    }
    for (const n of nodes.values()) {
      const openChildren = n.children.filter((c: string) => {
        const ch = nodes.get(c);
        return ch && (ch.status === "open" || ch.status === "in-flight");
      });
      if (openChildren.length >= 8) warnings.push(`node ${n.node_id} has ${openChildren.length} open children — prune or confirm before expanding more`);
    }
    return warnings.length === 0 ? "" : `Bounds advisory:\n${warnings.map((w) => `- ${w}`).join("\n")}`;
  } catch { return ""; }
}

export function registerBeforeAgentStartHook(pi: any) {
  pi.on("before_agent_start", async (event: any, ctx: any) => {
    startTurn(`turn-${Date.now()}`);

    pi.setActiveTools?.(["read", "grep", ...PLANNER_TOOL_NAMES]);

    const provider = detectProvider(event?.model ?? ctx?.model);
    const persona = await loadPersona(provider).catch(() => "");
    const plannerSys = await fs
      .readFile(join(HERE, "..", "..", "..", "prompts", "planner-system.md"), "utf8")
      .catch(() => "");

    const eng = await activeEngagementId();
    let agentsMd = "";
    let globalAgentsMd = "";
    if (eng) {
      try {
        agentsMd = await fs.readFile(join(engagementDir(eng), "AGENTS.md"), "utf8");
      } catch {}
    }
    try {
      globalAgentsMd = await fs.readFile(join(vibehackRoot(), "AGENTS.md"), "utf8");
    } catch {}

    let handoff = "";
    if (eng) {
      const { consumePendingHandoff } = await import("../lib/pending-handoff.ts");
      handoff = await consumePendingHandoff(eng);
    }

    let steer = "";
    if (eng) {
      const { consumeSteer } = await import("../lib/pending-steer.ts");
      steer = await consumeSteer(eng);
    }

    const gate = getMutationGateMessage();

    let bounds = "";
    if (eng) bounds = await buildBoundsAdvisory(eng);

    let verificationAdvisoryBlock = "";
    if (eng) {
      try {
        const { readEvents } = await import("../lib/events.ts");
        const evs = await readEvents(engagementDir(eng));
        verificationAdvisoryBlock = buildVerificationAdvisory(evs as any[]);
      } catch {}
    }

    const blocks: string[] = [];
    if (persona) blocks.push(persona);
    if (plannerSys) blocks.push(plannerSys);
    if (globalAgentsMd.trim()) blocks.push(`<pinned_global>\n${globalAgentsMd}\n</pinned_global>`);
    if (agentsMd.trim()) blocks.push(`<pinned_engagement>\n${agentsMd}\n</pinned_engagement>`);
    if (handoff.trim()) blocks.push(`<handoff_from_prior_subprocess>\n${handoff}\n</handoff_from_prior_subprocess>`);
    if (steer.trim()) blocks.push(`<operator_steer>\n${steer}\n</operator_steer>`);
    if (gate) blocks.push(`<invariant>${gate}</invariant>`);
    if (bounds) blocks.push(`<bounds_advisory>${bounds}</bounds_advisory>`);
    if (verificationAdvisoryBlock) blocks.push(verificationAdvisoryBlock);

    const newSystem = (event.systemPrompt ?? "") + "\n\n" + blocks.join("\n\n");
    return { systemPrompt: newSystem };
  });
}
