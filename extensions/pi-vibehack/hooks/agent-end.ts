// v1.4 — autonomous-mode follow-up driver.
//
// On agent_end, if auto-mode is enabled for the active engagement and budget
// remains, we send a follow-up user message that re-enters the loop. pi-mono
// delivers it via {deliverAs: "followUp"} on the next opportunity.
//
// We deliberately keep the message short — the system prompt already carries
// the <auto_mode> steer block from /vibehack-auto. This is the wheel-turn.

import type { ExtensionAPI } from "../lib/typed-pi.ts";
import { activeEngagementId } from "../lib/engagement.ts";
import { readAutoMode, bumpTurn, haltAutoMode, detectCompletionHalt } from "../lib/auto-loop.ts";

export function registerAgentEndHook(pi: ExtensionAPI) {
  pi.on("agent_end" as any, async (_event: any, ctx: any) => {
    try {
      const eng = await activeEngagementId();
      if (!eng) return;
      const st = await readAutoMode(eng);
      if (!st.enabled) return;

      // Detect completion before consuming a turn from the budget.
      const completion = await detectCompletionHalt(eng);
      if (completion) {
        await haltAutoMode(eng, completion);
        try { ctx?.ui?.notify?.(`auto-mode halted: ${completion}`, "info"); } catch {}
        return;
      }

      // Bump turn counter; if that exhausts budget, the writer flips enabled=false.
      const updated = await bumpTurn(eng);
      if (!updated.enabled) {
        try { ctx?.ui?.notify?.(`auto-mode halted: ${updated.halted_reason}`, "info"); } catch {}
        return;
      }

      // Fire the follow-up. Short prompt — the system prompt already carries policy.
      try {
        if (typeof (pi as any).sendUserMessage === "function") {
          await (pi as any).sendUserMessage(
            `[auto-mode turn ${updated.turns_used}/${updated.max_turns}] continue: advance the highest-priority open node, or commit it via confirm/dead-end.`,
            { deliverAs: "followUp" },
          );
        }
      } catch (e: any) {
        await haltAutoMode(eng, `sendUserMessage failed: ${e?.message ?? String(e)}`);
      }
    } catch {}
  });
}
