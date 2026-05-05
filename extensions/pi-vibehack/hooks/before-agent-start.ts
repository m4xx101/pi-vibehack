import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { activeEngagementId, engagementDir, vibehackRoot } from "../lib/engagement.ts";
import { detectProvider, loadPersona } from "../lib/persona.ts";
import { getActivePersona } from "../lib/persona-registry.ts";
import { PLANNER_TOOL_NAMES } from "../tools/index.ts";
import { startTurn } from "../lib/turn-state.ts";
import { getMutationGateMessage } from "./tool-result.ts";
import type { ExtensionAPI, ExtensionContext, BeforeAgentStartEvent, BeforeAgentStartEventResult } from "../lib/typed-pi.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// v1.2: pi-mono natively walks AGENTS.md/CLAUDE.md from cwd
// (resource-loader.js:31) and loads SYSTEM.md / APPEND_SYSTEM.md from
// `~/.pi/agent/` (resource-loader.js:662, 666, 673, 677). Re-reading
// AGENTS.md ourselves duplicates that work and risks drift. We keep the
// dual-load behind `vibehack.agentsMdCompat: true` for one minor version
// per the v1.2 plan's Risk #2 mitigation.
async function shouldDualLoadAgentsMd(): Promise<boolean> {
  try {
    const cfgPath =
      process.env.VIBEHACK_CONFIG_PATH ||
      join(homedir(), ".pi", "agent", "vibehack", "config.yaml");
    const { readConfig } = await import("../lib/config-runtime.ts");
    const cfg = readConfig(cfgPath);
    return !!(cfg && cfg.vibehack && cfg.vibehack.agentsMdCompat === true);
  } catch {
    return false;
  }
}

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

export function registerBeforeAgentStartHook(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event: BeforeAgentStartEvent, ctx: ExtensionContext): Promise<BeforeAgentStartEventResult | void> => {
    try {
    startTurn(`turn-${Date.now()}`);

    // v1.4: merge per-engagement loaded lazy tools (vibehack_run_<bin>) into
    // the active set. CS's "lazy registry" pattern — registered eagerly at
    // extension load, exposed only when the planner calls vibehack_load_tools.
    let lazyLoaded: string[] = [];
    try {
      const eng0 = await activeEngagementId();
      if (eng0) {
        const { getLoadedSet } = await import("../lib/lazy-tools.ts");
        lazyLoaded = [...(await getLoadedSet(eng0))];
      }
    } catch {}
    pi.setActiveTools?.(["read", "grep", ...PLANNER_TOOL_NAMES, ...lazyLoaded]);

    // Neither BeforeAgentStartEvent nor ExtensionContext have a documented
    // `model` field, but legacy pi versions exposed one — keep the defensive
    // access via a local cast so we still pick it up if present.
    const provider = detectProvider((event as any)?.model ?? (ctx as any)?.model);
    const persona = await loadPersona(provider).catch(() => "");
    const plannerSys = await fs
      .readFile(join(HERE, "..", "..", "..", "prompts", "planner-system.md"), "utf8")
      .catch(() => "");

    const eng = await activeEngagementId();
    let agentsMd = "";
    let globalAgentsMd = "";
    // pi-mono natively loads AGENTS.md/CLAUDE.md by walking cwd
    // (resource-loader.js:31) and SYSTEM.md / APPEND_SYSTEM.md from
    // ~/.pi/agent (resource-loader.js:662, 666, 673, 677). Re-reading them
    // here is opt-in via vibehack.agentsMdCompat for one minor version.
    if (await shouldDualLoadAgentsMd()) {
      if (eng) {
        try {
          agentsMd = await fs.readFile(join(engagementDir(eng), "AGENTS.md"), "utf8");
        } catch {}
      }
      try {
        globalAgentsMd = await fs.readFile(join(vibehackRoot(), "AGENTS.md"), "utf8");
      } catch {}
    }

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

    // v1.3: prepend the active specialist persona (web-application / mobile /
    // cloud-security / etc.). General persona body is empty so this is a no-op
    // by default.
    let specialistPersona = "";
    if (eng) {
      try {
        const p = await getActivePersona(eng);
        if (p.body) specialistPersona = p.body;
      } catch {}
    }

    const blocks: string[] = [];
    if (persona) blocks.push(persona);
    if (plannerSys) blocks.push(plannerSys);
    if (specialistPersona) blocks.push(specialistPersona);
    if (globalAgentsMd.trim()) blocks.push(`<pinned_global>\n${globalAgentsMd}\n</pinned_global>`);
    if (agentsMd.trim()) blocks.push(`<pinned_engagement>\n${agentsMd}\n</pinned_engagement>`);
    if (handoff.trim()) blocks.push(`<handoff_from_prior_subprocess>\n${handoff}\n</handoff_from_prior_subprocess>`);
    if (steer.trim()) blocks.push(`<operator_steer>\n${steer}\n</operator_steer>`);
    if (gate) blocks.push(`<invariant>${gate}</invariant>`);
    if (bounds) blocks.push(`<bounds_advisory>${bounds}</bounds_advisory>`);
    if (verificationAdvisoryBlock) blocks.push(verificationAdvisoryBlock);

    const newSystem = (event.systemPrompt ?? "") + "\n\n" + blocks.join("\n\n");
    return { systemPrompt: newSystem };
    } catch (e) {
      try { ctx?.ui?.notify?.(`[pi-vibehack] before_agent_start failed: ${(e as Error).message}`, "warning"); } catch {}
      return {};
    }
  });
}
