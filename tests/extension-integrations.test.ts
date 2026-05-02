import { describe, it, expect, vi } from "vitest";
import { activateIntegrations } from "../extensions/pi-vibehack/integrations/index.ts";

describe("activateIntegrations", () => {
  it("no-ops when no extensions detected", () => {
    const fakePi = { register: vi.fn() };
    activateIntegrations(fakePi, { extensions: {}, skills: [] });
    expect(fakePi.register).not.toHaveBeenCalled();
  });

  it("activates pi-mcp-adapter when present", () => {
    const fakePi = { register: vi.fn() };
    activateIntegrations(fakePi, {
      extensions: { "pi-mcp-adapter": { name: "pi-mcp-adapter", path: "/x" } },
      skills: [],
    });
    expect(fakePi.register).toHaveBeenCalledWith(expect.objectContaining({ integration: "pi-mcp-adapter" }));
  });

  it("activates all 5 integrations independently when all present", () => {
    const fakePi = { register: vi.fn() };
    activateIntegrations(fakePi, {
      extensions: {
        "pi-mcp-adapter": { name: "pi-mcp-adapter", path: "/" },
        "memory-mode": { name: "memory-mode", path: "/" },
        "handoff": { name: "handoff", path: "/" },
        "pi-rewind-hook": { name: "pi-rewind-hook", path: "/" },
        "pi-side-chat": { name: "pi-side-chat", path: "/" },
      },
      skills: [],
    });
    expect(fakePi.register).toHaveBeenCalledTimes(5);
  });

  it("activation failure on one integration doesn't block others", () => {
    const fakePi = {
      register: vi.fn((arg) => {
        if (arg.integration === "memory-mode") throw new Error("boom");
      }),
    };
    activateIntegrations(fakePi, {
      extensions: {
        "memory-mode": { name: "memory-mode", path: "/" },
        "handoff": { name: "handoff", path: "/" },
      },
      skills: [],
    });
    expect(fakePi.register).toHaveBeenCalledTimes(2);
  });

  it("ignores extensions outside the documented 5-integration registry", () => {
    const fakePi = { register: vi.fn() };
    activateIntegrations(fakePi, {
      extensions: { "some-random-extension": { name: "some-random-extension", path: "/" } },
      skills: [],
    });
    expect(fakePi.register).not.toHaveBeenCalled();
  });
});
