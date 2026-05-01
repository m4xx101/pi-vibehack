import { Type } from "@sinclair/typebox";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso, readEvents, newNodeId } from "../lib/events.ts";

export const expandSchema = Type.Object({
  parent_id: Type.Union([Type.String(), Type.Null()]),
  kind: Type.Union([Type.Literal("root"), Type.Literal("surface"), Type.Literal("hypothesis"), Type.Literal("leaf")]),
  phase: Type.Union([Type.Literal("recon"), Type.Literal("enum"), Type.Literal("exploit"), Type.Literal("post-ex"), Type.Literal("lateral"), Type.Literal("report")]),
  claim: Type.String({ minLength: 1 }),
  next_test: Type.String(),
  falsifier: Type.String(),
  confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  requires_browser: Type.Optional(Type.Boolean()),
  rationale: Type.String(),
});

export const expandTool = {
  name: "vibehack_expand",
  label: "Expand hypothesis",
  description: "Add a node to the hypothesis tree. Required falsifier. Returns the new node_id.",
  parameters: expandSchema,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, ctx?: any) {
    if (params.kind !== "root" && (!params.falsifier || params.falsifier.trim().length === 0)) {
      throw new Error("falsifier is required for non-root nodes");
    }
    const eng = await activeEngagementId();
    if (!eng) throw new Error("no active engagement (call /vibehack <target> first)");
    const dir = engagementDir(eng);
    const events = await readEvents(dir);
    const siblingCount = events.filter((e) => e.event === "node_add" && e.parent_id === params.parent_id).length;
    const node_id = newNodeId(params.parent_id, siblingCount);

    await appendEvent(dir, {
      ts: nowIso(),
      engagement_id: eng,
      event: "node_add",
      node_id,
      parent_id: params.parent_id,
      kind: params.kind,
      phase: params.phase,
      claim: params.claim,
      next_test: params.next_test,
      falsifier: params.falsifier,
      confidence: params.confidence ?? 0.5,
      status: "open",
      requires_browser: params.requires_browser ?? false,
      evidence: [],
      cost_tokens: 0,
      cost_usd: 0,
      rationale: params.rationale,
      metadata: {},
    });

    ctx?.ui?.notify?.(`expanded ${node_id}: ${params.claim}`, "info");
    return {
      content: [{ type: "text", text: `expanded node ${node_id} (${params.kind}/${params.phase})` }],
      details: { node_id, kind: params.kind, phase: params.phase },
    };
  },
};
