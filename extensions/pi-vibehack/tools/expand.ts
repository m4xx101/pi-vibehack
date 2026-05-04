import { Type } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import { activeEngagementId, engagementDir, newEngagementId, setActiveEngagement } from "../lib/engagement.ts";
import { appendEvent, nowIso, readEvents, newNodeId } from "../lib/events.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

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
}, { additionalProperties: false });

export const expandTool = {
  name: "vibehack_expand",
  label: "Expand hypothesis",
  description: "Add a node to the hypothesis tree. Required falsifier. Returns the new node_id.",
  parameters: expandSchema,

  // Field-aliasing shim: LLMs often emit camelCase (`parentId`, `nextTest`,
  // `requiresBrowser`) when the schema demands snake_case. Run BEFORE TypeBox
  // validation. Defensive: any throw falls back to the original args via
  // safePrepare, letting validation produce its normal error.
  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, {
      // No special renames — generic camelCase→snake_case covers all fields.
      // `id` → `node_id` is not relevant for expand (no node_id input).
    }),
  ) as any,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, ctx?: any) {
    if (params.kind !== "root" && (!params.falsifier || String(params.falsifier ?? "").trim().length === 0)) {
      throw new Error("falsifier is required for non-root nodes");
    }
    let eng = await activeEngagementId();
    // Auto-bootstrap on root-expand. The /vibehack <target> slash command renders
    // a prompt instructing the LLM to call vibehack_expand(parent_id:null, kind:"root",
    // claim:"engagement: <target>", ...). We use that root call as the engagement
    // boot signal: derive the engagement id from the claim, create the dir, write
    // the .active marker, emit engagement_start.
    if (!eng) {
      if (params.kind !== "root" || params.parent_id !== null) {
        throw new Error("no active engagement (call /vibehack <target> first)");
      }
      const target = String(params.claim ?? "")
        .replace(/^engagement:\s*/i, "")
        .trim() || "untargeted";
      eng = newEngagementId(target);
      await fs.mkdir(engagementDir(eng), { recursive: true });
      await setActiveEngagement(eng);
      await appendEvent(engagementDir(eng), {
        ts: nowIso(),
        engagement_id: eng,
        event: "engagement_start",
        metadata: { target },
      } as any);
      ctx?.ui?.notify?.(`engagement started: ${eng}`, "info");
    }
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
