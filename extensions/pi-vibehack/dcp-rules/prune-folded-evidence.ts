// If a tool_result message has been folded into the tree as an evidence_add,
// the working-context copy is redundant. Mark prune.
// Tagged via global Set `__vibehack_folded_call_ids` populated by the
// tool_result hook (Phase 27) when evidence folds into the tree.

export function markCallFolded(callId: string): void {
  const g = globalThis as any;
  g.__vibehack_folded_call_ids ??= new Set<string>();
  g.__vibehack_folded_call_ids.add(callId);
}

export const pruneFoldedEvidenceRule = {
  name: "vibehack:prune-folded-evidence",
  prepare(messages: any[], _ctx?: any): any[] {
    const folded: Set<string> | undefined = (globalThis as any).__vibehack_folded_call_ids;
    return messages.map((m) => {
      const callId = m?.toolCallId ?? m?.tool_call_id;
      if (!callId || !folded || !folded.has(callId)) return m;
      return { ...m, _vibehack_dcp: { ...(m._vibehack_dcp ?? {}), prune_folded_evidence: true } };
    });
  },
  decide(message: any): "prune" | "keep" {
    return message?._vibehack_dcp?.prune_folded_evidence ? "prune" : "keep";
  },
};
