// Phase 4 of v1.2 — when ctx.hasUI=true and operator declines, canary-verify
// returns { error: "user-blocked" } instead of planting.

import { describe, it, expect, vi } from "vitest";
import { canaryVerifyTool } from "../extensions/pi-vibehack/tools/canary-verify.ts";

function ctxWith(answer: boolean) {
  const confirm = vi.fn().mockResolvedValue(answer);
  return {
    ctx: {
      engagementDir: "/tmp/vh-noop",
      eventsPath: "/tmp/vh-noop/events.jsonl",
      engagement_id: "test",
      pinnedCollector: "https://example.com",
      hasUI: true,
      ui: { confirm },
    },
    confirm,
  };
}

describe("canary-verify ctx.ui.confirm gate", () => {
  it("returns user-blocked when operator declines", async () => {
    const { ctx, confirm } = ctxWith(false);
    const r: any = await (canaryVerifyTool as any).execute(
      "cid",
      { node_id: "n1", kind: "DNS" },
      undefined,
      undefined,
      ctx,
    );
    expect(confirm).toHaveBeenCalled();
    expect(r.error).toBe("user-blocked");
  });

  it("does NOT prompt when hasUI is false (print/RPC mode)", async () => {
    const confirm = vi.fn();
    const r: any = await (canaryVerifyTool as any).execute(
      "cid",
      { node_id: "n2", kind: "DNS" },
      undefined,
      undefined,
      {
        engagementDir: "/tmp/vh-noop",
        eventsPath: "/tmp/vh-noop/events.jsonl",
        engagement_id: "test",
        pinnedCollector: null,
        hasUI: false,
        ui: { confirm },
      },
    );
    expect(confirm).not.toHaveBeenCalled();
    // collector missing → existing error, NOT user-blocked
    expect(r.error).toMatch(/collector/);
  });
});
