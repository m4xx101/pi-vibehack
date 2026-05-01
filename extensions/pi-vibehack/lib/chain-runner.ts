import { activeEngagementId, engagementDir } from "./engagement.ts";
import { readEvents, appendEvent, nowIso } from "./events.ts";
import { spawnOperator, type OperatorInput } from "./operator-spawn.ts";
import { buildHandoff } from "./handoff.ts";
import type { OperatorOutput } from "./operator-output-schema.ts";

export interface ChainStep {
  node_id: string;
  next_test: string;
  expected_outcome: string;
}

export interface ChainResult {
  steps: { step: ChainStep; result: OperatorOutput | { error: string } }[];
  halted_at?: number;
  halt_reason?: string;
}

/**
 * Walk the events backward to locate the most recent chain proposal.
 *
 * Returns the proposal payload if the latest chain-related event is a
 * `chain_propose`. If a `chain_confirm` or `chain_reject` is seen first, the
 * proposal is already resolved and null is returned.
 */
export async function findLatestProposal(
  engagement_id: string,
): Promise<{ root_node_id: string; steps: ChainStep[]; is_destructive: boolean } | null> {
  const events = await readEvents(engagementDir(engagement_id));
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i] as any;
    if (e.event === "chain_propose") {
      return {
        root_node_id: e.node_id,
        steps: (e.metadata?.steps as ChainStep[] | undefined) ?? [],
        is_destructive: !!e.metadata?.is_destructive,
      };
    }
    if (e.event === "chain_confirm" || e.event === "chain_reject") return null;
  }
  return null;
}

/**
 * Execute the most recent pending chain proposal step-by-step.
 *
 * - Each step spawns an Operator with phase=post-ex; the previous handoff
 *   string is threaded forward via {@link buildHandoff}.
 * - If `interactive` is true and `promptForStep` returns false, the chain
 *   halts with reason="operator-halt".
 * - A `falsified` outcome halts with reason="falsified".
 * - A spawn error halts with reason="spawn-error" and records the message.
 */
export async function runChain(opts: {
  interactive: boolean;
  promptForStep?: (i: number, step: ChainStep) => Promise<boolean>;
  systemPromptBody: string;
}): Promise<ChainResult> {
  const eng = await activeEngagementId();
  if (!eng) throw new Error("no active engagement");
  const proposal = await findLatestProposal(eng);
  if (!proposal) throw new Error("no chain proposal pending");

  await appendEvent(engagementDir(eng), {
    ts: nowIso(),
    engagement_id: eng,
    event: "chain_confirm",
    node_id: proposal.root_node_id,
    metadata: { interactive: opts.interactive },
  } as any);

  const result: ChainResult = { steps: [] };
  let prevHandoff = "";
  for (let i = 0; i < proposal.steps.length; i++) {
    const step = proposal.steps[i];
    if (opts.interactive && opts.promptForStep) {
      const proceed = await opts.promptForStep(i, step);
      if (!proceed) {
        result.halted_at = i;
        result.halt_reason = "operator-halt";
        break;
      }
    }
    const input: OperatorInput = {
      engagement_id: eng,
      node_id: step.node_id,
      phase: "post-ex",
      claim: `chain step ${i + 1}: ${step.expected_outcome}`,
      next_test: step.next_test,
      falsifier: `step did not produce expected outcome: ${step.expected_outcome}`,
      previous_handoff: prevHandoff || undefined,
    };
    try {
      const out = await spawnOperator(input, opts.systemPromptBody);
      result.steps.push({ step, result: out });
      if (out.outcome === "falsified") {
        result.halted_at = i;
        result.halt_reason = "falsified";
        break;
      }
      prevHandoff = buildHandoff(out);
    } catch (e: any) {
      result.steps.push({ step, result: { error: e.message } });
      result.halted_at = i;
      result.halt_reason = "spawn-error";
      break;
    }
  }
  return result;
}
