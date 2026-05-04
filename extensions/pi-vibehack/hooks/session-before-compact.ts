// session_before_compact hook: distills lessons from confirmed leaves, mirrors
// them into both the global lessons.jsonl and the per-engagement event log,
// then returns a custom compaction summary that pi will use in place of its
// default. Each section is best-effort — any failure aborts the custom summary
// (pi falls back to its default) rather than blowing up the compact path.

import { join } from "node:path";
import { activeEngagementId, engagementDir, vibehackRoot } from "../lib/engagement.ts";
import { readEvents, appendEvent, eventsPath, nowIso } from "../lib/events.ts";
import { foldNodes, type Node } from "../render/tree-md.ts";
import { distillFromEngagement, appendLesson } from "../lib/lessons.ts";
import { runReflection } from "../lib/reflection.ts";
import type { ExtensionAPI, ExtensionContext, SessionBeforeCompactEvent } from "../lib/typed-pi.ts";

export function registerSessionBeforeCompactHook(pi: ExtensionAPI) {
  pi.on("session_before_compact", async (_event: SessionBeforeCompactEvent, _ctx: ExtensionContext) => {
    try {
      const eng = await activeEngagementId();
      if (!eng) return;
      const dir = engagementDir(eng);

      // Best-effort: distill lessons + mirror into engagement event log.
      try {
        const lessons = await distillFromEngagement(dir);
        for (const l of lessons) {
          try { await appendLesson(l); } catch {}
          try {
            await appendEvent(dir, {
              ts: nowIso(),
              engagement_id: eng,
              event: "lesson",
              rationale: l.situation,
              metadata: { action: l.action, outcome: l.outcome },
            });
          } catch {}
        }
      } catch {}

      // Best-effort: Layer B reflection — cluster confirmed leaves and write
      // refined recipes into ~/.pi/agent/vibehack/skills/learned/. Failure
      // never blocks compaction.
      try {
        const learnedDir = join(vibehackRoot(), "skills", "learned");
        await runReflection({
          eventsPath: eventsPath(dir),
          learnedDir,
          scope: "compact",
        });
      } catch {}

      // Best-effort: build custom summary from current tree state.
      try {
        const events = await readEvents(dir);
        const nodes = foldNodes(events);
        const confirmed: Node[] = [];
        const open: Node[] = [];
        for (const n of nodes.values()) {
          if (n.status === "confirmed") confirmed.push(n);
          else if (n.status === "open" || n.status === "in-flight") open.push(n);
        }
        confirmed.sort((a, b) => a.node_id.localeCompare(b.node_id));
        open.sort((a, b) => a.node_id.localeCompare(b.node_id));

        const lines: string[] = [];
        lines.push(`# pi-vibehack engagement ${eng} (compacted)`);
        lines.push("");
        lines.push(`## Confirmed (${confirmed.length})`);
        for (const n of confirmed) lines.push(`- ${n.node_id}: ${n.claim}`);
        lines.push("");
        lines.push(`## Open hypotheses (${open.length})`);
        for (const n of open) {
          const test = n.next_test ?? "(no test)";
          lines.push(`- ${n.node_id} (${n.kind}/${n.phase}): ${n.claim} — test: ${test}`);
        }
        lines.push("");
        lines.push(
          `Read engagements/${eng}/events.jsonl and tree.md for full state. Auto-recall is active.`,
        );
        const summary = lines.join("\n") + "\n";
        // NOTE: { customSummary } is a legacy/pre-API shape preserved as-is to
        // avoid behavioural change in this Phase-1 type-only refactor. The
        // proper Phase-3 fix is to return { compaction: CompactionResult } per
        // SessionBeforeCompactResult (types.d.ts:747). Cast through unknown
        // to keep typecheck green without altering runtime semantics.
        return { customSummary: summary } as unknown as undefined;
      } catch {
        return;
      }
    } catch {
      return;
    }
  });
}
