// vibehack_canary_verify (Phase 12) — Planner tool that plants a canary
// appropriate for the vuln class and emits a canary_planted event so the
// Planner can incorporate the secret/URL into the next_test instruction.
//
// Tool shape note: this tool uses a plain JSONSchema + handler(args, ctx)
// signature distinct from the older Typebox/execute tools (confirm.ts et al.).
// The Planner host adapts both. The plain-schema shape is what Phase 12 spec §3.5
// prescribes and what the host harness already wires for the verifier path.
//
// Side-effect classification: this tool is NEITHER hypothesis-mutating NOR a
// proposal. It plants a marker; the marker's *retrieval* is what eventually
// drives a verification_pass event via the tool_result hook. So it is added to
// PLANNER_TOOL_NAMES but not to HYPOTHESIS_MUTATING_TOOLS or PROPOSAL_TOOLS.

import { plantFileCanary, plantHttpCallbackCanary } from "../lib/canary.ts";
import * as fs from "fs";
import * as crypto from "crypto";

export const canaryVerifyTool = {
  name: "vibehack_canary_verify",
  schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["node_id", "kind"],
    properties: {
      node_id: { type: "string" as const },
      kind: {
        type: "string" as const,
        enum: ["RCE", "AFR", "SSRF", "blind-OOB", "open-redirect", "DNS"] as const,
      },
    },
  },
  async handler(
    args: { node_id: string; kind: string },
    ctx: {
      engagementDir: string;
      eventsPath: string;
      engagement_id: string;
      pinnedCollector?: string | null;
    },
  ): Promise<any> {
    const ts = new Date().toISOString();

    // OOB classes (DNS / blind-OOB) require operator-pinned collector.
    if (args.kind === "DNS" || args.kind === "blind-OOB") {
      if (!ctx.pinnedCollector) {
        return {
          error:
            "no OOB collector pinned — see /vibehack-pin canary-collector: <url>",
        };
      }
      const uuid = crypto.randomUUID();
      let host: string;
      try {
        host = new URL(ctx.pinnedCollector).host;
      } catch {
        return { error: `invalid pinnedCollector URL: ${ctx.pinnedCollector}` };
      }
      const subdomain = `${uuid}.${host}`;
      const canaryKind = args.kind === "DNS" ? "dns" : "blind-oob";

      fs.appendFileSync(
        ctx.eventsPath,
        JSON.stringify({
          event: "canary_planted",
          engagement_id: ctx.engagement_id,
          node_id: args.node_id,
          canary_kind: canaryKind,
          uuid,
          ref: subdomain,
          callback_url: ctx.pinnedCollector,
          ts,
        }) + "\n",
      );
      return { uuid, kind: canaryKind, subdomain };
    }

    // Filesystem classes (RCE, AFR).
    if (args.kind === "RCE" || args.kind === "AFR") {
      const c = plantFileCanary(ctx.engagementDir, args.kind);
      fs.appendFileSync(
        ctx.eventsPath,
        JSON.stringify({
          event: "canary_planted",
          engagement_id: ctx.engagement_id,
          node_id: args.node_id,
          canary_kind: "filesystem",
          uuid: c.uuid,
          ref: c.ref,
          ts,
        }) + "\n",
      );
      return { uuid: c.uuid, kind: c.kind, ref: c.ref, secret: c.secret };
    }

    // Network classes (SSRF, open-redirect) → http-callback.
    const c = await plantHttpCallbackCanary(ctx.engagementDir);
    fs.appendFileSync(
      ctx.eventsPath,
      JSON.stringify({
        event: "canary_planted",
        engagement_id: ctx.engagement_id,
        node_id: args.node_id,
        canary_kind: "http-callback",
        uuid: c.uuid,
        ref: c.callback_url,
        callback_url: c.callback_url,
        ts,
      }) + "\n",
    );
    return { uuid: c.uuid, kind: c.kind, callback_url: c.callback_url };
  },
};
