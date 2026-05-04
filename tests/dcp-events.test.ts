import { describe, it, expect, vi } from "vitest";
import vibehack from "../extensions/pi-vibehack/index.ts";
import { ALL_DCP_RULES } from "../extensions/pi-vibehack/dcp-rules/index.ts";

function makeStubPi() {
  const emit = vi.fn();
  const on = vi.fn();
  const pi = {
    events: { emit, on },
    on: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerHook: vi.fn(),
    registerProvider: vi.fn(),
    registerUI: vi.fn(),
    registerStatusBanner: vi.fn(),
    registerTreeViewer: vi.fn(),
    registerMessageRenderer: vi.fn(),
    setSessionName: vi.fn(),
    setActiveTools: vi.fn(),
  };
  return { pi, emit, on };
}

describe("pi.events emission for dcp rules", () => {
  it("emits 'vibehack/dcp-rules' with ALL_DCP_RULES on extension load", () => {
    const { pi, emit } = makeStubPi();
    vibehack(pi as any);
    const call = emit.mock.calls.find((c) => c[0] === "vibehack/dcp-rules");
    expect(call).toBeDefined();
    expect(call?.[1]).toBe(ALL_DCP_RULES);
  });
});
