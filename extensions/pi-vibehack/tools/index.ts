export { expandTool } from "./expand.ts";
export { pruneTool } from "./prune.ts";
export { confirmTool } from "./confirm.ts";
export { evidenceTool } from "./evidence.ts";
export { deadEndTool } from "./dead-end.ts";
export { proposeChainTool } from "./propose-chain.ts";
export { proposeSpecialistTool } from "./propose-specialist.ts";
export { recallTool } from "./recall.ts";
export { canaryVerifyTool } from "./canary-verify.ts";

export const PLANNER_TOOL_NAMES = [
  "vibehack_expand",
  "vibehack_prune",
  "vibehack_confirm",
  "vibehack_evidence",
  "vibehack_dead_end",
  "vibehack_propose_chain",
  "vibehack_propose_specialist",
  "vibehack_recall",
  "vibehack_canary_verify",
];

// Tools whose call genuinely advances the tree (state-mutating). Phase 5's
// hypothesis-or-die invariant requires at least one of these per turn —
// proposals do NOT count as mutations because they stage operator-gated
// changes that may never apply.
export const HYPOTHESIS_MUTATING_TOOLS = new Set([
  "vibehack_expand",
  "vibehack_prune",
  "vibehack_confirm",
  "vibehack_evidence",
  "vibehack_dead_end",
]);

// Operator-gated proposals. Distinct from mutations: they don't satisfy the
// hypothesis-or-die invariant on their own (a turn that only proposes a chain
// without expanding/pruning/etc. has not advanced the tree).
export const PROPOSAL_TOOLS = new Set([
  "vibehack_propose_chain",
  "vibehack_propose_specialist",
]);
