import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";
import { turnMutated } from "../lib/turn-state.ts";
import {
  detectMissingHeaders,
  detectFilteredPorts,
  looksLikeHttpResponse,
  parseHttpHeaders,
} from "../lib/negative-space.ts";

export function registerToolResultHook(pi: any) {
  pi.on("tool_result", async (event: any, _ctx: any) => {
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
      const { triggerGraphifyUpdate } = await import("../graph/recall.ts");
      triggerGraphifyUpdate(dir).catch(() => {});
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
