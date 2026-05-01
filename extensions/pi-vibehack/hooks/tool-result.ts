import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";
import { turnMutated } from "../lib/turn-state.ts";

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
    // Negative-space synthesis is appended here in Phase 6.
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
