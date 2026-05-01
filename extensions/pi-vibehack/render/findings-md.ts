import { foldNodes, type Node } from "./tree-md.ts";
import type { VibehackEvent } from "../lib/event-schema.ts";

export function renderFindingsMd(events: VibehackEvent[], engagementId: string): string {
  const nodes = foldNodes(events);
  const confirmed: Node[] = [];
  for (const n of nodes.values()) if (n.status === "confirmed") confirmed.push(n);
  confirmed.sort((a, b) => a.node_id.localeCompare(b.node_id));

  const lines: string[] = [];
  lines.push(`# Findings: ${engagementId}`);
  lines.push("");
  if (confirmed.length === 0) {
    lines.push("_no confirmed findings yet_");
    return lines.join("\n") + "\n";
  }
  for (const n of confirmed) {
    lines.push(`## ${n.node_id} — ${n.claim}`);
    lines.push("");
    lines.push(`- **Phase:** ${n.phase}`);
    lines.push(`- **Confidence:** ${n.confidence !== undefined ? n.confidence.toFixed(2) : "n/a"}`);
    lines.push(`- **PoC:** \`poc/${n.node_id}/poc.md\``);
    if (n.evidence.length > 0) {
      lines.push("- **Evidence:**");
      for (const e of n.evidence) lines.push(`  - ${e.kind}: ${e.summary} (\`${e.ref}\`)`);
    }
    lines.push("");
  }
  return lines.join("\n") + "\n";
}
