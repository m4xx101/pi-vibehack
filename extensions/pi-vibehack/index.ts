import { registerSessionStartHook } from "./hooks/session-start.ts";
import { registerBeforeAgentStartHook } from "./hooks/before-agent-start.ts";
import { registerToolCallHook } from "./hooks/tool-call.ts";
import { registerToolResultHook } from "./hooks/tool-result.ts";
import { registerBeforeProviderRequestHook } from "./hooks/before-provider-request.ts";
import { registerSessionBeforeCompactHook } from "./hooks/session-before-compact.ts";
import { registerStatusBanner } from "./ui/status-banner.ts";
import { registerTreeViewer } from "./ui/tree-viewer.ts";
import { ALL_DCP_RULES } from "./dcp-rules/index.ts";
import {
  expandTool, pruneTool, confirmTool, evidenceTool, deadEndTool,
  proposeChainTool, proposeSpecialistTool, recallTool, canaryVerifyTool,
} from "./tools/index.ts";

export default function vibehack(pi: any) {
  // Tools
  pi.registerTool(expandTool);
  pi.registerTool(pruneTool);
  pi.registerTool(confirmTool);
  pi.registerTool(evidenceTool);
  pi.registerTool(deadEndTool);
  pi.registerTool(proposeChainTool);
  pi.registerTool(proposeSpecialistTool);
  pi.registerTool(recallTool);
  pi.registerTool(canaryVerifyTool);

  // Hooks
  registerSessionStartHook(pi);
  registerBeforeAgentStartHook(pi);
  registerToolCallHook(pi);
  registerToolResultHook(pi);
  registerBeforeProviderRequestHook(pi);
  registerSessionBeforeCompactHook(pi);

  // UI
  registerStatusBanner(pi);
  registerTreeViewer(pi);

  // DCP rules — picked up by pi-dcp via the vibehackDcpRules export below.
  // pi-dcp documents its own registration shape; we expose the rules and let it pull.
  (globalThis as any).__vibehack_dcp_rules = ALL_DCP_RULES;

  // Custom commands
  pi.registerCommand?.("vibehack-cost", {
    description: "Show cost readout for the active engagement",
    handler: async (_args: string, ctx: any) => {
      const { activeEngagementId, engagementDir } = await import("./lib/engagement.ts");
      const eng = await activeEngagementId();
      if (!eng) { ctx.ui.notify("no active engagement", "warn"); return; }
      const { readEvents } = await import("./lib/events.ts");
      const events = await readEvents(engagementDir(eng));
      let total = 0;
      const byTool: Record<string, number> = {};
      for (const e of events) {
        total += e.cost_usd ?? 0;
        if (e.event === "tool_result") {
          const t = (e as any).metadata?.tool_name ?? "unknown";
          byTool[t] = (byTool[t] ?? 0) + (e.cost_usd ?? 0);
        }
      }
      const lines = [`Engagement ${eng}: $${total.toFixed(4)}`];
      for (const [t, v] of Object.entries(byTool).sort((a, b) => b[1] - a[1])) lines.push(`  ${t}: $${v.toFixed(4)}`);
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand?.("vibehack-update", {
    description: "Bump pinned pi-vibehack version in settings.json",
    handler: async (_args: string, ctx: any) => {
      ctx.ui.notify("run `npx -y @m4xx101/pi-vibehack install` to update; /reload after.", "info");
    },
  });

  pi.registerCommand?.("vibehack-pin", {
    description: "Pin a fact to engagement (or global with --global) AGENTS.md",
    handler: async (args: string, ctx: any) => {
      const { promises: fs } = await import("node:fs");
      const { join } = await import("node:path");
      const { activeEngagementId, engagementDir, vibehackRoot } = await import("./lib/engagement.ts");
      const isGlobal = /(^|\s)--global(\s|$)/.test(args);
      const fact = args.replace(/(^|\s)--global(\s|$)/, " ").trim();
      if (!fact) { ctx.ui.notify("usage: /vibehack-pin <fact> [--global]", "warn"); return; }
      const eng = await activeEngagementId();
      const path = isGlobal || !eng ? join(vibehackRoot(), "AGENTS.md") : join(engagementDir(eng), "AGENTS.md");
      await fs.mkdir(join(path, ".."), { recursive: true });
      await fs.appendFile(path, `\n- [${new Date().toISOString()}] ${fact}\n`, "utf8");
      ctx.ui.notify(`pinned to ${path}`, "info");
    },
  });

  pi.registerCommand?.("vibehack-handoff", {
    description: "Generate cross-session/cross-engagement handoff prompt",
    handler: async (args: string, ctx: any) => {
      const { activeEngagementId, engagementDir } = await import("./lib/engagement.ts");
      const { readEvents } = await import("./lib/events.ts");
      const { foldNodes } = await import("./render/tree-md.ts");
      const eng = args.trim() || await activeEngagementId();
      if (!eng) { ctx.ui.notify("no engagement", "warn"); return; }
      const events = await readEvents(engagementDir(eng));
      const nodes = foldNodes(events);
      const open = [...nodes.values()].filter((n) => n.status === "open" || n.status === "in-flight");
      const summary = [
        `# Handoff for engagement ${eng}`,
        `Open hypotheses (${open.length}):`,
        ...open.map((n) => `- ${n.node_id}: ${n.claim} — test: ${n.next_test ?? "(none)"}`),
      ].join("\n");
      const { promises: fs } = await import("node:fs");
      const { join } = await import("node:path");
      await fs.writeFile(join(engagementDir(eng), "handoff.md"), summary, "utf8");
      ctx.ui.notify(summary, "info");
    },
  });

  pi.registerCommand?.("vibehack-chain-confirm", {
    description: "Run the most recent proposed exploit chain",
    handler: async (args: string, ctx: any) => {
      const { activeEngagementId } = await import("./lib/engagement.ts");
      const eng = await activeEngagementId();
      if (!eng) { ctx.ui.notify("no active engagement", "warn"); return; }
      const { runChain } = await import("./lib/chain-runner.ts");
      const interactive = /--interactive/.test(args);
      const { promises: fs } = await import("node:fs");
      const { join, dirname } = await import("node:path");
      const { fileURLToPath } = await import("node:url");
      const HERE = dirname(fileURLToPath(import.meta.url));
      const sys = await fs.readFile(join(HERE, "..", "..", "subagents", "vibehack-operator.md"), "utf8");
      const r = await runChain({
        interactive,
        promptForStep: interactive ? async (i, step) => {
          if (typeof ctx.ui?.confirm === "function") {
            return !!(await ctx.ui.confirm("Run next chain step?", `step ${i + 1}: ${step.expected_outcome}`));
          }
          return true;
        } : undefined,
        systemPromptBody: sys,
      });
      ctx.ui.notify(`chain finished: ${r.steps.length} step(s)${r.halted_at !== undefined ? ` (halted at step ${r.halted_at + 1}: ${r.halt_reason})` : ""}`, "info");
    },
  });

  pi.registerCommand?.("steer", {
    description: "Inject a free-text steering note into the next Planner turn",
    handler: async (args: string, ctx: any) => {
      const { activeEngagementId } = await import("./lib/engagement.ts");
      const { appendSteer } = await import("./lib/pending-steer.ts");
      const { appendEvent, nowIso } = await import("./lib/events.ts");
      const eng = await activeEngagementId();
      if (!eng) { ctx.ui.notify("no active engagement", "warn"); return; }
      const text = args.trim();
      if (!text) { ctx.ui.notify("usage: /steer <text>", "warn"); return; }
      await appendSteer(eng, text);
      try {
        const { engagementDir } = await import("./lib/engagement.ts");
        await appendEvent(engagementDir(eng), { ts: nowIso(), engagement_id: eng, event: "steer", rationale: text } as any);
      } catch {}
      ctx.ui.notify(`steered: ${text}`, "info");
    },
  });

  pi.registerCommand?.("vibehack-chain-reject", {
    description: "Reject the most recent proposed chain",
    handler: async (args: string, ctx: any) => {
      const { activeEngagementId, engagementDir } = await import("./lib/engagement.ts");
      const { findLatestProposal } = await import("./lib/chain-runner.ts");
      const { appendEvent, nowIso } = await import("./lib/events.ts");
      const eng = await activeEngagementId();
      if (!eng) { ctx.ui.notify("no engagement", "warn"); return; }
      const p = await findLatestProposal(eng);
      if (!p) { ctx.ui.notify("no chain pending", "warn"); return; }
      await appendEvent(engagementDir(eng), {
        ts: nowIso(), engagement_id: eng, event: "chain_reject",
        node_id: p.root_node_id, rationale: args.trim() || "operator rejected",
      } as any);
      ctx.ui.notify(`chain ${p.root_node_id} rejected`, "info");
    },
  });
}

// pi-dcp pulls rules from this export shape if it scans extension exports.
export const vibehackDcpRules = ALL_DCP_RULES;
