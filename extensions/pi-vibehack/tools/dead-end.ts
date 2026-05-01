import { Type } from "@sinclair/typebox";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";

export const deadEndSchema = Type.Object({
  node_id: Type.String(),
  reason: Type.String(),
});

export const deadEndTool = {
  name: "vibehack_dead_end",
  label: "Mark dead end",
  description: "Clean exit from hypothesis-or-die loop when stuck. Marks node status=dead.",
  parameters: deadEndSchema,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, ctx?: any) {
    const eng = await activeEngagementId();
    if (!eng) throw new Error("no active engagement (call /vibehack <target> first)");
    await appendEvent(engagementDir(eng), {
      ts: nowIso(),
      engagement_id: eng,
      event: "node_update",
      node_id: params.node_id,
      status: "dead",
      rationale: params.reason,
    });
    ctx?.ui?.notify?.(`dead-end ${params.node_id}`, "warn");
    return { content: [{ type: "text", text: `marked ${params.node_id} dead` }], details: {} };
  },
};
