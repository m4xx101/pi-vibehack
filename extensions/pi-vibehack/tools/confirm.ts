import { Type } from "@sinclair/typebox";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";

export const confirmSchema = Type.Object({
  node_id: Type.String(),
  poc_summary: Type.String(),
  evidence_refs: Type.Array(Type.String()),
});

export const confirmTool = {
  name: "vibehack_confirm",
  label: "Confirm leaf",
  description: "Mark a leaf confirmed; triggers per-leaf reporter spawn.",
  parameters: confirmSchema,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, ctx?: any) {
    const eng = await activeEngagementId();
    if (!eng) throw new Error("no active engagement (call /vibehack <target> first)");
    const dir = engagementDir(eng);
    await appendEvent(dir, {
      ts: nowIso(),
      engagement_id: eng,
      event: "confirm",
      node_id: params.node_id,
      status: "confirmed",
      rationale: params.poc_summary,
      metadata: { evidence_refs: params.evidence_refs },
    });
    ctx?.ui?.notify?.(`confirmed ${params.node_id}`, "success");
    return {
      content: [{ type: "text", text: `confirmed ${params.node_id}; reporter will run` }],
      details: { node_id: params.node_id, trigger_reporter: true },
    };
  },
};
