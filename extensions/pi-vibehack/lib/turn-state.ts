import { HYPOTHESIS_MUTATING_TOOLS } from "../tools/index.ts";

export interface TurnState {
  turn_id: string;
  mutated: boolean;
  tool_calls: { name: string; ts: string }[];
}

let current: TurnState = { turn_id: "init", mutated: false, tool_calls: [] };

export function startTurn(turnId: string) {
  current = { turn_id: turnId, mutated: false, tool_calls: [] };
}

export function recordToolCall(name: string) {
  current.tool_calls.push({ name, ts: new Date().toISOString() });
  if (HYPOTHESIS_MUTATING_TOOLS.has(name)) current.mutated = true;
}

export function turnMutated(): boolean {
  return current.mutated;
}

export function turnToolCalls(): { name: string; ts: string }[] {
  return current.tool_calls.slice();
}

export function currentTurnId(): string {
  return current.turn_id;
}
