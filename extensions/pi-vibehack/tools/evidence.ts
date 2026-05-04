import { Type } from "@sinclair/typebox";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

export const evidenceSchema = Type.Object({
  node_id: Type.String(),
  kind: Type.String(),
  ref: Type.String(),
  summary: Type.String(),
}, { additionalProperties: false });

export const evidenceTool = {
  name: "vibehack_evidence",
  label: "Add evidence",
  description: "Attach evidence to a node (read-only mutation; counts toward hypothesis-or-die).",
  parameters: evidenceSchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, { id: "node_id", evidenceType: "kind", evidence_type: "kind" }),
  ) as any,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, _ctx?: any) {
    const eng = await activeEngagementId();
    if (!eng) throw new Error("no active engagement (call /vibehack <target> first)");
    const dir = engagementDir(eng);
    await appendEvent(dir, {
      ts: nowIso(),
      engagement_id: eng,
      event: "evidence_add",
      node_id: params.node_id,
      evidence: [{ ts: nowIso(), kind: params.kind, ref: params.ref, summary: params.summary, synthetic: false }],
    });
    return { content: [{ type: "text", text: `evidence attached to ${params.node_id}` }], details: {} };
  },
};
