// session_start hook: rehydrates the DCP dead-node set from the event log so
// pruned/dead branches stay folded after a restart, then announces the active
// engagement to the operator.

import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { readEvents } from "../lib/events.ts";
import { foldNodes } from "../render/tree-md.ts";
import { markNodeDead } from "../dcp-rules/index.ts";

export function registerSessionStartHook(pi: any) {
  pi.on("session_start", async (_event: any, ctx: any) => {
    try {
      const eng = await activeEngagementId();
      if (!eng) {
        ctx?.ui?.notify?.(
          "pi-vibehack ready · no active engagement (run /vibehack <target>)",
          "info",
        );
        return;
      }
      const events = await readEvents(engagementDir(eng));
      const nodes = foldNodes(events);
      for (const n of nodes.values()) {
        if (n.status === "dead" || n.status === "pruned") {
          try { markNodeDead(n.node_id); } catch {}
        }
      }
      ctx?.ui?.notify?.(
        `pi-vibehack resumed engagement ${eng} (${nodes.size} nodes)`,
        "info",
      );
    } catch (e: any) {
      ctx?.ui?.notify?.(
        `pi-vibehack session_start failed: ${e?.message ?? String(e)}`,
        "warn",
      );
    }
  });
}
