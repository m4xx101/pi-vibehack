import { Type } from "@sinclair/typebox";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";

export const proposeSpecialistSchema = Type.Object({
  node_id: Type.String(),
  specialist_kind: Type.String(),
  rationale: Type.String(),
}, { additionalProperties: false });

export const proposeSpecialistTool = {
  name: "vibehack_propose_specialist",
  label: "Propose specialist role",
  description: "Declare that an Operator subprocess for this node should spawn with a specialist skill (web-recon, web-exploit, binary-recon, auth-bypass, osint, or operator-grown kind).",
  parameters: proposeSpecialistSchema,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, _ctx?: any) {
    const eng = await activeEngagementId();
    if (!eng) throw new Error("no active engagement (call /vibehack <target> first)");
    await appendEvent(engagementDir(eng), {
      ts: nowIso(),
      engagement_id: eng,
      event: "specialist_propose",
      node_id: params.node_id,
      rationale: params.rationale,
      metadata: { specialist_kind: params.specialist_kind },
    });
    return { content: [{ type: "text", text: `specialist=${params.specialist_kind} pinned to ${params.node_id}` }], details: { specialist_kind: params.specialist_kind } };
  },
};
