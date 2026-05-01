import { Type } from "@sinclair/typebox";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";

export const proposeChainSchema = Type.Object({
  root_node_id: Type.String(),
  steps: Type.Array(Type.Object({
    node_id: Type.String(),
    next_test: Type.String(),
    expected_outcome: Type.String(),
  })),
  rationale: Type.String(),
  is_destructive: Type.Boolean(),
});

export const proposeChainTool = {
  name: "vibehack_propose_chain",
  label: "Propose exploit chain",
  description: "Propose a sequential chain of post-exploitation steps. Operator confirms before execution.",
  parameters: proposeChainSchema,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, ctx?: any) {
    const eng = await activeEngagementId();
    if (!eng) throw new Error("no active engagement (call /vibehack <target> first)");
    await appendEvent(engagementDir(eng), {
      ts: nowIso(),
      engagement_id: eng,
      event: "chain_propose",
      node_id: params.root_node_id,
      rationale: params.rationale,
      metadata: { steps: params.steps, is_destructive: params.is_destructive },
    });
    ctx?.ui?.notify?.(`chain proposed: ${params.steps.map((s: any) => s.node_id).join(" -> ")}. /vibehack-chain-confirm to run, /vibehack-chain-reject to skip.`, "warn");
    return { content: [{ type: "text", text: `chain proposed (${params.steps.length} steps); awaiting operator` }], details: { steps: params.steps } };
  },
};
