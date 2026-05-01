// If a hypothesis-tree node has been marked dead (via a dead_end event),
// any messages tied to that node_id can be pruned from working context.
// Tagged via global Set `__vibehack_dead_node_ids`.

export function markNodeDead(node_id: string): void {
  const g = globalThis as any;
  g.__vibehack_dead_node_ids ??= new Set<string>();
  g.__vibehack_dead_node_ids.add(node_id);
}

export const pruneDeadBranchesRule = {
  name: "vibehack:prune-dead-branches",
  prepare(messages: any[], _ctx?: any): any[] {
    const dead: Set<string> | undefined = (globalThis as any).__vibehack_dead_node_ids;
    return messages.map((m) => {
      const nodeId = m?.metadata?.node_id ?? m?._vibehack_node_id;
      if (!nodeId || !dead || !dead.has(nodeId)) return m;
      return { ...m, _vibehack_dcp: { ...(m._vibehack_dcp ?? {}), prune_dead_branch: true } };
    });
  },
  decide(message: any): "prune" | "keep" {
    return message?._vibehack_dcp?.prune_dead_branch ? "prune" : "keep";
  },
};
