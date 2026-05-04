import * as fs from "node:fs";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";
import { turnMutated } from "../lib/turn-state.ts";
import {
  detectMissingHeaders,
  detectFilteredPorts,
  looksLikeHttpResponse,
  parseHttpHeaders,
} from "../lib/negative-space.ts";
import type { ExtensionAPI, ExtensionContext, ToolResultEvent } from "../lib/typed-pi.ts";

export interface VerifierResult {
  verified?: boolean;
  screenshot_ref?: string;
  dom_assertion_ref?: string;
  console_log_ref?: string;
  reason?: string;
}

export interface VerifierContext {
  node_id: string;
  kind: string;
  engagement_id: string;
}

export function validateVerifierResult(
  payload: VerifierResult,
  ctx: VerifierContext
): { event: any } {
  const ts = new Date().toISOString();

  if (payload.verified === false) {
    return {
      event: {
        event: "verification_fail",
        engagement_id: ctx.engagement_id,
        node_id: ctx.node_id,
        kind: ctx.kind,
        verifier: "browser-verifier",
        reason: payload.reason ?? "unverified",
        ts,
      },
    };
  }

  if (payload.verified === true) {
    const ssPath = payload.screenshot_ref;
    let ssOk = false;
    try {
      ssOk = !!ssPath && fs.existsSync(ssPath) && fs.statSync(ssPath).size > 0;
    } catch {
      ssOk = false;
    }
    if (!ssOk) {
      return {
        event: {
          event: "verification_advisory",
          engagement_id: ctx.engagement_id,
          node_id: ctx.node_id,
          kind: ctx.kind,
          message: "verifier returned verified=true but screenshot artifact missing or empty",
          ts,
        },
      };
    }
    return {
      event: {
        event: "verification_pass",
        engagement_id: ctx.engagement_id,
        node_id: ctx.node_id,
        kind: ctx.kind,
        verifier: "browser-verifier",
        evidence_ref: ssPath!,
        ts,
      },
    };
  }

  return {
    event: {
      event: "verification_advisory",
      engagement_id: ctx.engagement_id,
      node_id: ctx.node_id,
      kind: ctx.kind,
      message: "verifier returned ambiguous result (verified field missing or non-boolean)",
      ts,
    },
  };
}

export function registerToolResultHook(pi: ExtensionAPI) {
  pi.on("tool_result", async (typedEvent: ToolResultEvent, _ctx: ExtensionContext) => {
    // Local untyped alias: this hook still reads legacy fields (`output`,
    // `cost_usd`, `usage`, `context`, `structuredOutput`) that older pi
    // versions exposed. The typed shape only guarantees `content`. Cast once
    // here so the rest of the body compiles; full migration to typed
    // {content, details, isError} is deferred (Phase 3+).
    const event = typedEvent as ToolResultEvent & Record<string, any>;
    try {
    const eng = await activeEngagementId();
    if (!eng) return;
    const dir = engagementDir(eng);

    // Cost tally + result mirror — best-effort.
    const cost = event.cost_usd ?? event.usage?.cost_usd ?? 0;
    try {
      await appendEvent(dir, {
        ts: nowIso(),
        engagement_id: eng,
        event: "tool_result",
        cost_usd: cost,
        metadata: {
          tool_name: event.toolName,
          call_id: event.toolCallId,
          output_summary:
            typeof event.output === "string"
              ? event.output.slice(0, 500)
              : JSON.stringify(event.output).slice(0, 500),
        },
      } as any);
    } catch {}

    // Trigger graphify update on confirmed-mutation results (best-effort, fire-and-forget)
    if (["vibehack_confirm", "vibehack_evidence"].includes(event.toolName)) {
      const { triggerGraphifyUpdate, triggerGlobalGraphifyUpdate } = await import("../graph/recall.ts");
      triggerGraphifyUpdate(dir).catch(() => {});
      triggerGlobalGraphifyUpdate().catch(() => {});
    }

    // Negative-space synthesis on bash outputs.
    if (event.toolName === "bash" && typeof event.output === "string") {
      if (looksLikeHttpResponse(event.output)) {
        const headers = parseHttpHeaders(event.output);
        const missing = detectMissingHeaders(headers);
        for (const m of missing) {
          try {
            await appendEvent(dir, {
              ts: nowIso(),
              engagement_id: eng,
              event: "evidence_add",
              metadata: { synthetic: true },
              evidence: [{
                ts: nowIso(),
                kind: "negative-space:missing-header",
                ref: `tool_call:${event.toolCallId}`,
                summary: `missing ${m.header} (severity=${m.severity})`,
                synthetic: true,
              }],
            } as any);
          } catch {}
        }
      }
      // Nmap parsing: lines like "22/tcp open ssh"
      if (/^\d+\/tcp\s+\w+/m.test(event.output)) {
        const open = new Set<number>();
        for (const line of event.output.split(/\r?\n/)) {
          const m = /^(\d+)\/tcp\s+open/.exec(line);
          if (m) open.add(parseInt(m[1], 10));
        }
        if (open.size > 0) {
          const filtered = detectFilteredPorts(open);
          for (const f of filtered.slice(0, 3)) {
            try {
              await appendEvent(dir, {
                ts: nowIso(),
                engagement_id: eng,
                event: "evidence_add",
                metadata: { synthetic: true },
                evidence: [{
                  ts: nowIso(),
                  kind: "negative-space:filtered-port",
                  ref: `tool_call:${event.toolCallId}`,
                  summary: `port ${f.port} not in open set`,
                  synthetic: true,
                }],
              } as any);
            } catch {}
          }
        }
      }
    }

    // Mirror Operator-returned auth_state_changes into pi-super-curl config (if present)
    try {
      const out = (event as any).structuredOutput;
      if (out?.auth_state_changes && out.auth_state_changes.profile_id) {
        const { mirrorAuthProfile } = await import("../lib/scurl-bridge.ts");
        await mirrorAuthProfile(out.auth_state_changes);
      }
    } catch {}

    // Wire #1: per-leaf Reporter auto-spawn on confirm
    try {
      if (event.toolName === "vibehack_confirm" && event.output) {
        const out: any = typeof event.output === "string" ? null : event.output;
        const node_id = out?.details?.node_id ?? out?.node_id;
        if (node_id) {
          const { spawnReporter } = await import("../lib/reporter-spawn.ts");
          const { promises: fs2 } = await import("node:fs");
          const { join: j2, dirname: d2 } = await import("node:path");
          const { fileURLToPath: f2 } = await import("node:url");
          const HERE = d2(f2(import.meta.url));
          const sysBody = await fs2.readFile(j2(HERE, "..", "..", "..", "subagents", "vibehack-reporter.md"), "utf8").catch(() => "");
          spawnReporter({ engagement_id: eng, mode: "per-leaf", node_id, engagement_dir: dir } as any, sysBody)
            .catch((e: any) => fs2.appendFile(j2(dir, "audit.log"), `[${nowIso()}] reporter-per-leaf-fail node=${node_id} err=${e.message}\n`, "utf8").catch(() => {}));
        }
      }
    } catch {}

    // Browser-verifier specialist: validate screenshot before emitting verification_pass.
    try {
      const struct = (event as any).structuredOutput ?? (event as any).output;
      const looksLikeVerifier =
        struct &&
        typeof struct === "object" &&
        ("verified" in struct || "screenshot_ref" in struct) &&
        ("dom_assertion_ref" in struct || "console_log_ref" in struct || "screenshot_ref" in struct);
      const toolName: string = event.toolName ?? "";
      const isVerifierTool =
        /browser-verifier/i.test(toolName) ||
        (struct && struct.__verifier === "browser-verifier");
      if (looksLikeVerifier && isVerifierTool) {
        const node_id = struct.node_id ?? struct.context?.node_id ?? event.context?.node_id;
        const kind = struct.kind ?? struct.context?.kind ?? event.context?.kind;
        if (node_id && kind) {
          const out = validateVerifierResult(struct, {
            node_id,
            kind,
            engagement_id: eng,
          });
          await appendEvent(dir, out.event as any).catch(() => {});
        }
      }
    } catch {}

    // Wire #2: auto-handoff for the next subprocess from any subagent-style tool result
    try {
      const struct = (event as any).structuredOutput ?? (event as any).output?.structured;
      const looksLikeOperator = struct && typeof struct === "object" && "outcome" in struct && "handoff_summary" in struct;
      if (looksLikeOperator) {
        const { buildHandoff } = await import("../lib/handoff.ts");
        const { setPendingHandoff } = await import("../lib/pending-handoff.ts");
        const body = buildHandoff(struct as any);
        if (body) await setPendingHandoff(eng, body);
      }
    } catch {}
    } catch (e) {
      try { _ctx?.ui?.notify?.(`[pi-vibehack] tool_result hook failed: ${(e as Error).message}`, "warning"); } catch {}
      return;
    }
  });
}

/**
 * Returns the hypothesis-or-die gate string for the next `before_agent_start`
 * (Phase 10), or null if the last turn satisfied the invariant.
 *
 * The escape list contains ONLY tools that mark `mutated=true` in turn-state —
 * proposals (`vibehack_propose_chain`, `vibehack_propose_specialist`) stage
 * operator-gated changes that may never apply, so they intentionally do NOT
 * satisfy the invariant. Listing them here would create a confusing loop where
 * the agent does what the gate said and still gets gated next turn.
 */
export function getMutationGateMessage(): string | null {
  if (turnMutated()) return null;
  return (
    `[VIBEHACK INVARIANT] Last turn produced no tree mutation. Emit one of: ` +
    `vibehack_expand, vibehack_prune, vibehack_confirm, vibehack_evidence, ` +
    `or vibehack_dead_end <node_id> if genuinely stuck. ` +
    `(Note: vibehack_propose_chain and vibehack_propose_specialist do NOT ` +
    `satisfy the invariant — they stage operator-gated changes.)`
  );
}
