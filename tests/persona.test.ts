import { describe, it, expect } from "vitest";
import { detectProvider } from "../extensions/pi-vibehack/lib/persona.ts";

describe("detectProvider", () => {
  it("claude-* → claude", () => expect(detectProvider("claude-opus-4-7")).toBe("claude"));
  it("gpt-* → codex", () => expect(detectProvider("gpt-5")).toBe("codex"));
  it("gemini-* → gemini", () => expect(detectProvider("gemini-pro")).toBe("gemini"));
  it("qwen-* → local", () => expect(detectProvider("qwen-72b-instruct")).toBe("local"));
  it("undefined → local", () => expect(detectProvider(undefined)).toBe("local"));
});
