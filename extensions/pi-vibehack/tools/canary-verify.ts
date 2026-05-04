// vibehack_canary_verify (Phase 12) — Planner tool that plants a canary
// appropriate for the vuln class and emits a canary_planted event so the
// Planner can incorporate the secret/URL into the next_test instruction.
//
// Tool shape: matches the canonical Typebox `parameters` + `execute(callId,
// params, signal, onUpdate, ctx)` pattern used by confirm.ts / expand.ts /
// recall.ts. The `ctx` argument carries engagement metadata (engagementDir,
// eventsPath, engagement_id, pinnedCollector); the Planner host populates
// these for the verifier path.
//
// Side-effect classification: this tool is NEITHER hypothesis-mutating NOR a
// proposal. It plants a marker; the marker's *retrieval* is what eventually
// drives a verification_pass event via the tool_result hook. So it is added to
// PLANNER_TOOL_NAMES but not to HYPOTHESIS_MUTATING_TOOLS or PROPOSAL_TOOLS.

import { Type } from "@sinclair/typebox";
import { plantFileCanary, plantHttpCallbackCanary } from "../lib/canary.ts";
import * as fs from "fs";
import * as crypto from "crypto";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

export const canaryVerifySchema = Type.Object({
  node_id: Type.String(),
  kind: Type.Union([
    Type.Literal("RCE"),
    Type.Literal("AFR"),
    Type.Literal("SSRF"),
    Type.Literal("blind-OOB"),
    Type.Literal("open-redirect"),
    Type.Literal("DNS"),
  ]),
}, { additionalProperties: false });

export const canaryVerifyTool = {
  name: "vibehack_canary_verify",
  label: "Plant verification canary",
  description:
    "Plant a canary appropriate for the vuln class and emit canary_planted. " +
    "OOB classes (DNS, blind-OOB) require an operator-pinned collector.",
  parameters: canaryVerifySchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, {
      id: "node_id",
      vulnClass: "kind",
      vulnKind: "kind",
      vuln_class: "kind",
      vuln_kind: "kind",
    }),
  ) as any,

  async execute(
    _callId: string,
    params: { node_id: string; kind: string },
    _signal?: any,
    _onUpdate?: any,
    ctx?: {
      engagementDir: string;
      eventsPath: string;
      engagement_id: string;
      pinnedCollector?: string | null;
      hasUI?: boolean;
      ui?: { confirm?: (title: string, message: string, opts?: any) => Promise<boolean> };
    },
  ): Promise<any> {
    if (!ctx) throw new Error("vibehack_canary_verify requires ctx");
    const ts = new Date().toISOString();

    // v1.2 Phase 4: gate the destructive plant behind ctx.ui.confirm when a UI
    // is attached. Print/RPC mode (hasUI=false or no ui) skips the prompt to
    // preserve current scripted behaviour. Timeout treated as "no" per Risk #4.
    if (ctx.hasUI && typeof ctx.ui?.confirm === "function") {
      let ok = false;
      try {
        ok = !!(await ctx.ui.confirm(
          `Plant ${params.kind} canary?`,
          `node ${params.node_id} — this writes to the engagement workspace and may be observable to the target.`,
          { timeout: 60_000 } as any,
        ));
      } catch {
        ok = false;
      }
      if (!ok) return { error: "user-blocked", node_id: params.node_id, kind: params.kind };
    }

    // OOB classes (DNS / blind-OOB) require operator-pinned collector.
    if (params.kind === "DNS" || params.kind === "blind-OOB") {
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
      const canaryKind = params.kind === "DNS" ? "dns" : "blind-oob";

      fs.appendFileSync(
        ctx.eventsPath,
        JSON.stringify({
          event: "canary_planted",
          engagement_id: ctx.engagement_id,
          node_id: params.node_id,
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
    if (params.kind === "RCE" || params.kind === "AFR") {
      const c = plantFileCanary(ctx.engagementDir, params.kind);
      fs.appendFileSync(
        ctx.eventsPath,
        JSON.stringify({
          event: "canary_planted",
          engagement_id: ctx.engagement_id,
          node_id: params.node_id,
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
        node_id: params.node_id,
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
