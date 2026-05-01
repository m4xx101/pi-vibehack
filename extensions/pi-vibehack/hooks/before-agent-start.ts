import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { activeEngagementId, engagementDir, vibehackRoot } from "../lib/engagement.ts";
import { detectProvider, loadPersona } from "../lib/persona.ts";
import { PLANNER_TOOL_NAMES } from "../tools/index.ts";
import { startTurn } from "../lib/turn-state.ts";
import { getMutationGateMessage } from "./tool-result.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

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

    const gate = getMutationGateMessage();

    const blocks: string[] = [];
    if (persona) blocks.push(persona);
    if (plannerSys) blocks.push(plannerSys);
    if (globalAgentsMd.trim()) blocks.push(`<pinned_global>\n${globalAgentsMd}\n</pinned_global>`);
    if (agentsMd.trim()) blocks.push(`<pinned_engagement>\n${agentsMd}\n</pinned_engagement>`);
    if (handoff.trim()) blocks.push(`<handoff_from_prior_subprocess>\n${handoff}\n</handoff_from_prior_subprocess>`);
    if (gate) blocks.push(`<invariant>${gate}</invariant>`);

    const newSystem = (event.systemPrompt ?? "") + "\n\n" + blocks.join("\n\n");
    return { systemPrompt: newSystem };
  });
}
