import type { OperatorOutput } from "./operator-output-schema.ts";

/**
 * Build an auto-handoff prompt for the next subprocess given an OperatorOutput.
 *
 * Pure function — no I/O. Returns "" when the leaf is closed (outcome=confirmed),
 * letting the caller short-circuit and skip spawning a follow-up.
 */
export function buildHandoff(out: OperatorOutput): string {
  if (out.outcome === "confirmed") return "";

  const lines: string[] = [];
  lines.push(
    `Previous Operator finished node ${out.node_id} with outcome=${out.outcome} (confidence=${out.confidence.toFixed(2)}).`,
  );
  lines.push(`Handoff summary: ${out.handoff_summary}`);

  if (out.evidence && out.evidence.length > 0) {
    lines.push(`Captured evidence (${out.evidence.length}):`);
    for (const e of out.evidence.slice(0, 3)) {
      lines.push(`  - ${e.kind}: ${e.summary}`);
    }
  }

  if (out.suggested_next_steps && out.suggested_next_steps.length > 0) {
    const first = out.suggested_next_steps[0];
    lines.push(
      `Recommended next test: ${first.claim} — run: ${first.next_test} — falsifier: ${first.falsifier}`,
    );
  }

  if (out.auth_state_changes && Object.keys(out.auth_state_changes).length > 0) {
    lines.push(`Auth state changes: ${JSON.stringify(out.auth_state_changes)}`);
  }

  return lines.join("\n");
}
