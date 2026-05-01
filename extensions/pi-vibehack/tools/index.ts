export { expandTool } from "./expand.ts";
export { pruneTool } from "./prune.ts";
export { confirmTool } from "./confirm.ts";
export { evidenceTool } from "./evidence.ts";
export { deadEndTool } from "./dead-end.ts";
export { proposeChainTool } from "./propose-chain.ts";
export { proposeSpecialistTool } from "./propose-specialist.ts";
// recall.ts in Phase 12

export const PLANNER_TOOL_NAMES = [
  "vibehack_expand",
  "vibehack_prune",
  "vibehack_confirm",
  "vibehack_evidence",
  "vibehack_dead_end",
  "vibehack_propose_chain",
  "vibehack_propose_specialist",
  "vibehack_recall", // wired in Phase 12
];

export const HYPOTHESIS_MUTATING_TOOLS = new Set([
  "vibehack_expand", "vibehack_prune", "vibehack_confirm",
  "vibehack_evidence", "vibehack_dead_end",
  "vibehack_propose_chain", "vibehack_propose_specialist",
]);
