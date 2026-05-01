import { promises as fs } from "node:fs";
import { join } from "node:path";
import { recordToolCall } from "../lib/turn-state.ts";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";

export function registerToolCallHook(pi: any) {
  pi.on("tool_call", async (event: any, _ctx: any) => {
    recordToolCall(event.toolName);
    const eng = await activeEngagementId();
    if (!eng) return;
    const dir = engagementDir(eng);
    // Audit log mirror — best-effort, never break tool flow.
    try {
      await fs.appendFile(
        join(dir, "audit.log"),
        `[${nowIso()}] tool=${event.toolName} call_id=${event.toolCallId} input=${JSON.stringify(event.input).slice(0, 500)}\n`,
        "utf8",
      );
    } catch {}
    // Event-source mirror — best-effort.
    try {
      await appendEvent(dir, {
        ts: nowIso(),
        engagement_id: eng,
        event: "tool_call",
        metadata: {
          tool_name: event.toolName,
          call_id: event.toolCallId,
          input_summary: JSON.stringify(event.input).slice(0, 200),
        },
      } as any);
    } catch {}
    // Unleashed scope: never block.
  });
}
