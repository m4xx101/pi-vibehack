// Cross-session lessons distilled from confirmed hypothesis-tree leaves.
//
// Lessons accumulate in a single global JSONL at vibehackRoot()/lessons.jsonl
// so they survive across engagements and compactions. Each lesson is a
// situation/action/outcome triple plus a confidence score, derived from a
// confirmed leaf node in an engagement tree.

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { vibehackRoot } from "./engagement.ts";
import { readEvents } from "./events.ts";
import { foldNodes } from "../render/tree-md.ts";

export interface Lesson {
  ts: string;
  engagement_id: string;
  situation: string;
  action: string;
  outcome: string;
  confidence: number;
}

export function lessonsPath(): string {
  return join(vibehackRoot(), "lessons.jsonl");
}

export async function appendLesson(l: Lesson): Promise<void> {
  const p = lessonsPath();
  await fs.mkdir(dirname(p), { recursive: true });
  await fs.appendFile(p, JSON.stringify(l) + "\n", "utf8");
}

export async function readLessons(): Promise<Lesson[]> {
  let buf: string;
  try { buf = await fs.readFile(lessonsPath(), "utf8"); }
  catch (e: any) { if (e.code === "ENOENT") return []; throw e; }
  const out: Lesson[] = [];
  for (const raw of buf.split("\n")) {
    if (!raw) continue;
    try { out.push(JSON.parse(raw) as Lesson); }
    catch (e: any) {
      console.warn(`pi-vibehack: skipping malformed lessons.jsonl line (${e.message})`);
    }
  }
  return out;
}

/**
 * Distill lessons from an engagement directory by reading its event log,
 * folding into a node map, and emitting one Lesson per confirmed leaf.
 *
 * engagement_id is sourced from the first `engagement_start` event; falls back
 * to "unknown" if absent so distillation never silently drops a confirmed
 * branch even on a malformed log.
 */
export async function distillFromEngagement(engagementDir: string): Promise<Lesson[]> {
  const events = await readEvents(engagementDir);
  const nodes = foldNodes(events);
  const startEv = events.find((e) => e.event === "engagement_start");
  const engagementId = startEv?.engagement_id ?? "unknown";
  const ts = new Date().toISOString();
  const lessons: Lesson[] = [];
  for (const n of nodes.values()) {
    if (n.status !== "confirmed") continue;
    const conf = typeof n.confidence === "number" ? n.confidence : 1;
    lessons.push({
      ts,
      engagement_id: engagementId,
      situation: `${n.phase}: ${n.claim}`,
      action: n.next_test ?? "",
      outcome: `confirmed (confidence=${conf.toFixed(2)})`,
      confidence: conf,
    });
  }
  return lessons;
}
