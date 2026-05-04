// Append-only event log for the hypothesis tree. JSONL format.
//
// Concurrency: caller must serialize appends. No internal locking. The Planner
// is single-threaded today; if any future code path adds parallel writes,
// introduce a queue at the call site (or here, behind a flag).
//
// Atomicity: appendFile is not crash-safe; a power loss mid-write may leave a
// truncated trailing line. readEvents skips and warns on unparseable lines so
// one bad byte doesn't brick the engagement.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { EventSchema, type VibehackEvent } from "./event-schema.ts";

export function eventsPath(engagementDir: string): string {
  return join(engagementDir, "events.jsonl");
}

// v1.2 Phase 3: capture a reference to pi.appendEntry from the factory so every
// vibehack event ALSO lands in the pi session JSONL via the supported
// extension API (types.d.ts:845, runner.js binding). The engagement-scoped
// events.jsonl remains canonical; pi's session view gets a mirror so /resume
// shows the move history and registered message renderers can present them.
type AppendEntryFn = (customType: string, data?: unknown) => void;
let _appendEntry: AppendEntryFn | null = null;
export function setPiAppendEntry(fn: AppendEntryFn | null): void {
  _appendEntry = fn;
}

export async function appendEvent(engagementDir: string, ev: VibehackEvent): Promise<void> {
  if (!Value.Check(EventSchema, ev)) {
    const errs = [...Value.Errors(EventSchema, ev)].map((e) => `${e.path}: ${e.message}`);
    throw new Error(`invalid event: ${errs.join("; ")}`);
  }
  await fs.mkdir(engagementDir, { recursive: true });
  await fs.appendFile(eventsPath(engagementDir), JSON.stringify(ev) + "\n", "utf8");
  // Best-effort mirror to pi session JSONL — never block engagement writes on
  // pi-side failure.
  if (_appendEntry) {
    try { _appendEntry(`vibehack/${(ev as any).event ?? "event"}`, ev); } catch {}
  }
}

/**
 * Read all events from events.jsonl. Returns [] on ENOENT.
 *
 * Read-side resilience: malformed lines are skipped with a console.warn rather
 * than throwing. This protects against a single corrupt line (crash mid-write,
 * disk corruption, manual edit) blocking all future engagement work. If you
 * want strict mode, pass `{ strict: true }` and any parse failure throws.
 *
 * Type cast `as VibehackEvent` is unchecked at runtime by default. For
 * higher-trust callers pass `{ validate: true }` to schema-check each line.
 */
export async function readEvents(
  engagementDir: string,
  opts: { strict?: boolean; validate?: boolean } = {},
): Promise<VibehackEvent[]> {
  let buf: string;
  try { buf = await fs.readFile(eventsPath(engagementDir), "utf8"); }
  catch (e: any) { if (e.code === "ENOENT") return []; throw e; }
  const out: VibehackEvent[] = [];
  let lineNum = 0;
  for (const raw of buf.split("\n")) {
    lineNum++;
    if (!raw) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch (e: any) {
      if (opts.strict) throw new Error(`events.jsonl line ${lineNum}: parse failed (${e.message})`);
      console.warn(`pi-vibehack: skipping malformed events.jsonl line ${lineNum} (${e.message})`);
      continue;
    }
    if (opts.validate && !Value.Check(EventSchema, parsed)) {
      if (opts.strict) throw new Error(`events.jsonl line ${lineNum}: schema validation failed`);
      console.warn(`pi-vibehack: skipping invalid events.jsonl line ${lineNum} (schema mismatch)`);
      continue;
    }
    out.push(parsed as VibehackEvent);
  }
  return out;
}

export function nowIso(): string { return new Date().toISOString(); }

/**
 * Generate a node id from parent + sibling count.
 *
 * Format: n_root for the root, n_<N><letter> for root's children
 * (e.g. n_1a, n_2b, n_3c), and <parentId>_<N><letter> for deeper nodes
 * (e.g. n_1a_1a, n_1a_2b).
 *
 * Throws on siblingCount >= 26 — past 'z' the algorithm would emit non-letter
 * ASCII (`{`, `|`, ...). The Planner enforces breadth ≤ 8 (spec §2.3), so any
 * siblingCount that would overflow indicates a bug in the caller.
 */
export function newNodeId(parentId: string | null, siblingCount: number): string {
  if (parentId === null) return "n_root";
  if (!Number.isInteger(siblingCount) || siblingCount < 0) {
    throw new Error(`newNodeId: siblingCount must be a non-negative integer (got ${siblingCount})`);
  }
  if (siblingCount >= 26) {
    throw new Error(`newNodeId: siblingCount ${siblingCount} exceeds breadth limit 26 (Planner enforces breadth ≤ 8 — call the prune-or-confirm gate first)`);
  }
  const base = parentId === "n_root" ? "n" : parentId;
  const suffix = String.fromCharCode(97 + siblingCount); // a, b, c, ...
  return `${base}_${siblingCount + 1}${suffix}`;
}
