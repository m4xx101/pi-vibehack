// Removes tool_result entries older than the most recent N turns (default N=4).
const KEEP_LAST_N_TURNS = 4;

function turnIndex(messages: any[]): number[] {
  // Count "turn boundaries" — assume role==='assistant' messages mark turn ends.
  let t = 0;
  return messages.map((m) => {
    if (m?.role === "assistant") t++;
    return t;
  });
}

export const pruneStaleToolResultsRule = {
  name: "vibehack:prune-stale-tool-results",
  prepare(messages: any[]): any[] {
    const idx = turnIndex(messages);
    const lastTurn = idx[idx.length - 1] ?? 0;
    return messages.map((m, i) => {
      if (m?.role !== "tool" && !m?.toolResult) return m;
      const turn = idx[i];
      if (lastTurn - turn >= KEEP_LAST_N_TURNS) {
        return { ...m, _vibehack_dcp: { ...(m._vibehack_dcp ?? {}), prune_stale_tool_result: true } };
      }
      return m;
    });
  },
  decide(message: any): "prune" | "keep" {
    return message?._vibehack_dcp?.prune_stale_tool_result ? "prune" : "keep";
  },
};
