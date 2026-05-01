import { pruneStaleRecallRule } from "./prune-stale-recall.ts";
import { pruneStaleToolResultsRule } from "./prune-stale-tool-results.ts";
import { pruneFoldedEvidenceRule, markCallFolded } from "./prune-folded-evidence.ts";
import { pruneDeadBranchesRule, markNodeDead } from "./prune-dead-branches.ts";

export const ALL_DCP_RULES = [
  pruneStaleRecallRule,
  pruneStaleToolResultsRule,
  pruneFoldedEvidenceRule,
  pruneDeadBranchesRule,
];

export { markCallFolded, markNodeDead };

export function registerDcpRules(piDcp: any) {
  for (const r of ALL_DCP_RULES) piDcp.registerRule?.(r);
}
