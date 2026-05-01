import type { VibehackEvent } from "../lib/event-schema.ts";

export interface Node {
  node_id: string;
  parent_id: string | null;
  kind: string;
  phase: string;
  claim: string;
  next_test?: string;
  falsifier?: string;
  confidence?: number;
  status: string;
  requires_browser?: boolean;
  evidence: { ts: string; kind: string; ref: string; summary: string; synthetic?: boolean }[];
  cost_usd: number;
  rationale?: string;
  children: string[];
}

export const STATUS_EMOJI: Record<string, string> = {
  open: "🌳",
  "in-flight": "⏳",
  confirmed: "✅",
  pruned: "✂️",
  dead: "💀",
};

export function foldNodes(events: VibehackEvent[]): Map<string, Node> {
  const nodes = new Map<string, Node>();
  for (const e of events) {
    if (e.event === "node_add" && e.node_id) {
      nodes.set(e.node_id, {
        node_id: e.node_id,
        parent_id: e.parent_id ?? null,
        kind: e.kind ?? "hypothesis",
        phase: e.phase ?? "recon",
        claim: e.claim ?? "",
        next_test: e.next_test,
        falsifier: e.falsifier,
        confidence: e.confidence,
        status: e.status ?? "open",
        requires_browser: e.requires_browser ?? false,
        evidence: (e.evidence ?? []) as any,
        cost_usd: e.cost_usd ?? 0,
        rationale: e.rationale,
        children: [],
      });
    } else if (e.event === "node_update" && e.node_id) {
      const n = nodes.get(e.node_id);
      if (!n) {
        console.warn(`pi-vibehack: orphan node_update for ${e.node_id} (no prior node_add) — skipped`);
        continue;
      }
      if (e.claim !== undefined) n.claim = e.claim;
      if (e.next_test !== undefined) n.next_test = e.next_test;
      if (e.falsifier !== undefined) n.falsifier = e.falsifier;
      if (e.confidence !== undefined) n.confidence = e.confidence;
      if (e.status !== undefined) n.status = e.status;
      // cost_usd on update is treated as the running total (snapshot replace,
      // not delta accumulate). Producers emit cumulative cost; if a producer
      // wants to emit deltas, change to += and rename the schema field to
      // cost_delta_usd so the meaning is unambiguous.
      if (e.cost_usd !== undefined) n.cost_usd = e.cost_usd;
      if (e.requires_browser !== undefined) n.requires_browser = e.requires_browser;
    } else if (e.event === "node_prune" && e.node_id) {
      const n = nodes.get(e.node_id);
      if (!n) { console.warn(`pi-vibehack: orphan node_prune for ${e.node_id} — skipped`); continue; }
      n.status = "pruned";
    } else if (e.event === "confirm" && e.node_id) {
      const n = nodes.get(e.node_id);
      if (!n) { console.warn(`pi-vibehack: orphan confirm for ${e.node_id} — skipped`); continue; }
      n.status = "confirmed";
    } else if (e.event === "evidence_add" && e.node_id && e.evidence) {
      const n = nodes.get(e.node_id);
      if (!n) { console.warn(`pi-vibehack: orphan evidence_add for ${e.node_id} — skipped`); continue; }
      n.evidence.push(...(e.evidence as any));
    }
  }
  // Wire children. parent_id pointing at a non-existent node = orphan;
  // surfaced as a warning so silent data loss is visible to the operator.
  for (const n of nodes.values()) {
    if (n.parent_id && nodes.has(n.parent_id)) {
      nodes.get(n.parent_id)!.children.push(n.node_id);
    } else if (n.parent_id && !nodes.has(n.parent_id) && n.node_id !== "n_root") {
      console.warn(`pi-vibehack: orphan node ${n.node_id} (parent ${n.parent_id} missing) — will not appear under root`);
    }
  }
  // Sort children deterministically (by node_id)
  for (const n of nodes.values()) n.children.sort();
  return nodes;
}

export function renderTreeMd(events: VibehackEvent[], engagementId: string): string {
  const nodes = foldNodes(events);
  const lines: string[] = [];
  lines.push(`# Engagement: ${engagementId}`);
  lines.push("");
  const root = nodes.get("n_root");
  if (!root) { lines.push("_no root yet_"); return lines.join("\n") + "\n"; }
  walk(root, 0, nodes, lines, new Set());
  // Cost rollup. Iterate sorted node ids so floating-point sum is order-stable
  // across event-stream permutations that produce the same logical tree.
  const ids = [...nodes.keys()].sort();
  let total = 0;
  for (const id of ids) total += nodes.get(id)!.cost_usd;
  lines.push("");
  lines.push(`**Total cost:** $${total.toFixed(4)}`);
  return lines.join("\n") + "\n";
}

function walk(n: Node, depth: number, nodes: Map<string, Node>, out: string[], visited: Set<string>) {
  if (visited.has(n.node_id)) {
    out.push(`${"  ".repeat(depth)}- ⚠️ cycle detected at ${n.node_id} (skipped)`);
    return;
  }
  visited.add(n.node_id);
  const indent = "  ".repeat(depth);
  const emoji = STATUS_EMOJI[n.status] ?? "❓"; // unmapped status → obvious glyph
  const conf = n.confidence !== undefined ? ` _(c=${n.confidence.toFixed(2)})_` : "";
  const browser = n.requires_browser ? " 🌐" : "";
  out.push(`${indent}- ${emoji} **${n.node_id}** (${n.kind})${browser} — ${n.claim}${conf}`);
  if (n.next_test) out.push(`${indent}  - _test:_ ${n.next_test}`);
  if (n.falsifier) out.push(`${indent}  - _falsifier:_ ${n.falsifier}`);
  for (const ev of n.evidence) {
    const synth = ev.synthetic ? " ⚪" : "";
    out.push(`${indent}  - 📎${synth} ${ev.kind}: ${ev.summary}`);
  }
  for (const cid of n.children) {
    const child = nodes.get(cid);
    if (child) walk(child, depth + 1, nodes, out, visited);
  }
}
