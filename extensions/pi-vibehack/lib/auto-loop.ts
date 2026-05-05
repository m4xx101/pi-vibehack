// v1.4 — real autonomous-mode driver.
//
// Per-engagement state file `.auto-mode` holds:
//   { enabled: boolean, max_turns: number, turns_used: number, started_at: iso }
//
// A `agent_end` hook reads the state. If enabled and budget remains, it sends
// a follow-up user message via pi.sendUserMessage(..., {deliverAs:"followUp"})
// asking the planner to continue. The planner's next turn lands naturally;
// this hook only fires the trigger.
//
// Halt conditions (any one stops the loop):
//   1. turns_used ≥ max_turns
//   2. all open hypothesis nodes are confirmed/dead (lib/events.ts foldNodes)
//   3. operator runs /vibehack-auto stop (or /steer with "halt auto")
//   4. fatal error in the previous turn
//
// We do NOT inject the auto_mode steer here — that's still done at /vibehack-auto
// invocation time so the planner sees the policy block. This file just keeps
// the wheel turning.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { engagementDir } from "./engagement.ts";

export interface AutoModeState {
  enabled: boolean;
  max_turns: number;
  turns_used: number;
  started_at?: string;
  halted_reason?: string;
}

const FILE = ".auto-mode";

export async function readAutoMode(eng: string): Promise<AutoModeState> {
  try {
    const raw = await fs.readFile(join(engagementDir(eng), FILE), "utf8");
    const parsed = JSON.parse(raw);
    return {
      enabled: !!parsed.enabled,
      max_turns: Number(parsed.max_turns ?? 0),
      turns_used: Number(parsed.turns_used ?? 0),
      started_at: parsed.started_at,
      halted_reason: parsed.halted_reason,
    };
  } catch {
    return { enabled: false, max_turns: 0, turns_used: 0 };
  }
}

export async function writeAutoMode(eng: string, st: AutoModeState): Promise<void> {
  const dir = engagementDir(eng);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, FILE), JSON.stringify(st, null, 2), "utf8");
}

export async function startAutoMode(eng: string, maxTurns: number): Promise<AutoModeState> {
  const st: AutoModeState = {
    enabled: true,
    max_turns: Math.max(1, Math.min(maxTurns, 50)),
    turns_used: 0,
    started_at: new Date().toISOString(),
  };
  await writeAutoMode(eng, st);
  return st;
}

export async function haltAutoMode(eng: string, reason: string): Promise<AutoModeState> {
  const st = await readAutoMode(eng);
  st.enabled = false;
  st.halted_reason = reason;
  await writeAutoMode(eng, st);
  return st;
}

export async function bumpTurn(eng: string): Promise<AutoModeState> {
  const st = await readAutoMode(eng);
  if (!st.enabled) return st;
  st.turns_used += 1;
  if (st.turns_used >= st.max_turns) {
    st.enabled = false;
    st.halted_reason = `budget exhausted (${st.turns_used}/${st.max_turns})`;
  }
  await writeAutoMode(eng, st);
  return st;
}

// Halt detection: every open node confirmed/dead. Returns a reason string or "".
export async function detectCompletionHalt(eng: string): Promise<string> {
  try {
    const { readEvents } = await import("./events.ts");
    const { foldNodes } = await import("../render/tree-md.ts");
    const events = await readEvents(engagementDir(eng));
    const nodes = foldNodes(events);
    if (nodes.size === 0) return "";
    let openCount = 0;
    for (const n of nodes.values()) {
      if (n.status === "open" || n.status === "in-flight") openCount++;
    }
    if (openCount === 0 && nodes.size > 0) {
      return `all ${nodes.size} hypothesis nodes resolved`;
    }
    return "";
  } catch {
    return "";
  }
}
