// Fires on the `context` event via pi-dcp's three-phase rule API.
// Removes <recall>...</recall> blocks from older turns; keeps only the most recent injection.
export const pruneStaleRecallRule = {
  name: "vibehack:prune-stale-recall",
  prepare(messages: any[]): any[] {
    let lastIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const c = messages[i]?.content;
      if (typeof c === "string" && c.includes("<recall>") && lastIdx === -1) lastIdx = i;
    }
    return messages.map((m, i) => {
      const c = m?.content;
      if (typeof c !== "string" || !c.includes("<recall>")) return m;
      if (i === lastIdx) return m;
      return { ...m, _vibehack_dcp: { ...(m._vibehack_dcp ?? {}), prune_stale_recall: true } };
    });
  },
  decide(message: any): "prune" | "keep" {
    return message?._vibehack_dcp?.prune_stale_recall ? "prune" : "keep";
  },
};
