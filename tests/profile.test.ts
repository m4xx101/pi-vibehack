import { describe, it, expect } from "vitest";
import { resolveProfile, defaultModelMap } from "../bin/lib/profile.js";

describe("profile resolver", () => {
  it("hybrid profile maps planner→haiku, operator→opus, reporter→opus", () => {
    const r = resolveProfile({ profile: "hybrid" });
    expect(r.planner).toBe("claude-haiku-4-5");
    expect(r.operator).toBe("claude-opus-4-7");
    expect(r.reporter).toBe("claude-opus-4-7");
  });

  it("frontier maps planner→sonnet, operator→opus, reporter→opus", () => {
    const r = resolveProfile({ profile: "frontier" });
    expect(r.planner).toBe("claude-sonnet-4-6");
  });

  it("local maps all to qwen-72b", () => {
    const r = resolveProfile({ profile: "local" });
    expect(r.planner).toBe("qwen-72b-instruct");
    expect(r.operator).toBe("qwen-72b-instruct");
    expect(r.reporter).toBe("qwen-72b-instruct");
  });

  it("per-role override takes precedence", () => {
    const r = resolveProfile({ profile: "hybrid", planner: "claude-sonnet-4-6" });
    expect(r.planner).toBe("claude-sonnet-4-6");
    expect(r.operator).toBe("claude-opus-4-7");
  });

  it("unknown profile throws", () => {
    expect(() => resolveProfile({ profile: "weird" })).toThrow(/unknown profile/i);
  });

  it("zero-arg call defaults to hybrid", () => {
    expect(resolveProfile().profile).toBe("hybrid");
    expect(resolveProfile().planner).toBe("claude-haiku-4-5");
  });

  it("returned profile field echoes input", () => {
    expect(resolveProfile({ profile: "frontier" }).profile).toBe("frontier");
    expect(resolveProfile({ profile: "local" }).profile).toBe("local");
  });
});
