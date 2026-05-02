import { describe, it, expect } from "vitest";
import { renderStatusBanner } from "../extensions/pi-vibehack/ui/status-banner.ts";

describe("status-banner v1.0.1 cost telemetry", () => {
  it("renders ⚡ $X (last turn) from most recent tool_result with cost_usd", () => {
    const events = [
      { type: "tool_result", node_id: "n1", cost_usd: 0.01, ts: "2026-05-02T10:00:00.000Z" },
      { type: "tool_result", node_id: "n2", cost_usd: 0.04, ts: "2026-05-02T10:01:00.000Z" },
    ];
    const banner = renderStatusBanner({
      events,
      treeNodes: 5,
      confirmed: 0,
      config: { ui: { banner: { show_last_turn_cost: true, show_engagement_cost: true, cost_warn_threshold_usd: 0.5 } } },
    });
    expect(banner).toContain("⚡ $0.04");
    expect(banner).toMatch(/💰 \$0\.05/);
  });

  it("colors the last-turn cost red when above threshold", () => {
    const events = [{ type: "tool_result", node_id: "n1", cost_usd: 0.75, ts: "2026-05-02T10:00:00.000Z" }];
    const banner = renderStatusBanner({
      events, treeNodes: 1, confirmed: 0,
      config: { ui: { banner: { show_last_turn_cost: true, show_engagement_cost: true, cost_warn_threshold_usd: 0.5 } } },
    });
    expect(banner).toMatch(/\[31m.*\$0\.75/);
  });

  it("does NOT color when under threshold", () => {
    const events = [{ type: "tool_result", node_id: "n1", cost_usd: 0.25, ts: "2026-05-02T10:00:00.000Z" }];
    const banner = renderStatusBanner({
      events, treeNodes: 1, confirmed: 0,
      config: { ui: { banner: { show_last_turn_cost: true, show_engagement_cost: true, cost_warn_threshold_usd: 0.5 } } },
    });
    expect(banner).not.toMatch(/\[31m/);
    expect(banner).toContain("⚡ $0.25");
  });

  it("hides last-turn cost when show_last_turn_cost: false", () => {
    const events = [{ type: "tool_result", node_id: "n1", cost_usd: 0.01, ts: "2026-05-02T10:00:00.000Z" }];
    const banner = renderStatusBanner({
      events, treeNodes: 1, confirmed: 0,
      config: { ui: { banner: { show_last_turn_cost: false, show_engagement_cost: true, cost_warn_threshold_usd: 0.5 } } },
    });
    expect(banner).not.toContain("(last turn)");
    expect(banner).toContain("💰");
  });

  it("hides engagement cost when show_engagement_cost: false", () => {
    const events = [{ type: "tool_result", node_id: "n1", cost_usd: 0.01, ts: "2026-05-02T10:00:00.000Z" }];
    const banner = renderStatusBanner({
      events, treeNodes: 1, confirmed: 0,
      config: { ui: { banner: { show_last_turn_cost: true, show_engagement_cost: false, cost_warn_threshold_usd: 0.5 } } },
    });
    expect(banner).not.toContain("💰");
    expect(banner).toContain("⚡");
  });

  it("treats missing config as defaults (both costs shown, threshold 0.5)", () => {
    const events = [{ type: "tool_result", node_id: "n1", cost_usd: 0.02, ts: "2026-05-02T10:00:00.000Z" }];
    const banner = renderStatusBanner({ events, treeNodes: 1, confirmed: 0 });
    expect(banner).toContain("⚡ $0.02");
    expect(banner).toContain("💰 $0.02");
  });

  it("ignores tool_result events without cost_usd", () => {
    const events = [
      { type: "tool_result", node_id: "n1", ts: "2026-05-02T10:00:00.000Z" },
      { type: "tool_result", node_id: "n2", cost_usd: 0.03, ts: "2026-05-02T10:01:00.000Z" },
    ];
    const banner = renderStatusBanner({ events, treeNodes: 2, confirmed: 0 });
    expect(banner).toContain("⚡ $0.03");
    expect(banner).toContain("💰 $0.03");
  });
});
