import { Type } from "@sinclair/typebox";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

export const pruneSchema = Type.Object({
  node_id: Type.String(),
  reason: Type.String(),
}, { additionalProperties: false });

export const pruneTool = {
  name: "vibehack_prune",
  label: "Prune branch",
  description: "Mark a node and all descendants pruned with a reason.",
  parameters: pruneSchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, { id: "node_id" }),
  ) as any,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, ctx?: any) {
    const eng = await activeEngagementId();
    if (!eng) throw new Error("no active engagement (call /vibehack <target> first)");
    const dir = engagementDir(eng);
    await appendEvent(dir, {
      ts: nowIso(),
      engagement_id: eng,
      event: "node_prune",
      node_id: params.node_id,
      status: "pruned",
      rationale: params.reason,
    });
    ctx?.ui?.notify?.(`pruned ${params.node_id}: ${params.reason}`, "info");
    return { content: [{ type: "text", text: `pruned ${params.node_id}` }], details: { node_id: params.node_id } };
  },
};
