import { describe, it, expect } from "vitest";
import { parseOperatorJson } from "../extensions/pi-vibehack/lib/operator-spawn.ts";

describe("parseOperatorJson", () => {
  it("parses pi --mode json final structured event", () => {
    const stdout = [
      `{"type":"agent_start","ts":1}`,
      `{"type":"tool_result","toolName":"structured_output","terminate":true,"output":{"node_id":"n_3a","outcome":"confirmed","evidence":[],"confidence":0.9,"suggested_next_steps":[],"handoff_summary":"x","cost_tokens":1,"cost_usd":0.001}}`,
      `{"type":"agent_end"}`,
    ].join("\n");
    const r = parseOperatorJson(stdout) as any;
    expect(r?.node_id).toBe("n_3a");
    expect(r?.outcome).toBe("confirmed");
  });

  it("falls back to trailing JSON block", () => {
    const stdout = `noise here\n{"node_id":"n_x","outcome":"falsified","evidence":[],"confidence":0.1,"suggested_next_steps":[],"handoff_summary":"","cost_tokens":0,"cost_usd":0}\n`;
    expect((parseOperatorJson(stdout) as any)?.node_id).toBe("n_x");
  });

  it("returns null on no JSON", () => {
    expect(parseOperatorJson("just text")).toBeNull();
  });
});
