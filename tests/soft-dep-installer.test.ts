import { describe, it, expect, vi } from "vitest";
import {
  detectMissingSoftDeps, fallbackFor, KNOWN_SOFT_DEPS, promptInstall,
} from "../extensions/pi-vibehack/lib/soft-dep-installer.ts";

describe("soft-dep-installer", () => {
  it("KNOWN_SOFT_DEPS includes pi-super-curl, surf-cli, graphify, playwright", () => {
    const names = KNOWN_SOFT_DEPS.map(d => d.name);
    expect(names).toContain("pi-super-curl");
    expect(names).toContain("surf-cli");
    expect(names).toContain("graphify");
    expect(names).toContain("playwright");
  });
  it("detectMissingSoftDeps returns deps absent from PATH", () => {
    const fakeWhich = vi.fn((cmd: string) => cmd === "pi-super-curl" ? "/usr/bin/pi-super-curl" : null);
    const missing = detectMissingSoftDeps({ which: fakeWhich });
    const missingNames = missing.map(d => d.name);
    expect(missingNames).not.toContain("pi-super-curl");
    expect(missingNames).toContain("surf-cli");
  });
  it("fallbackFor('http-probe')", () => { expect(fallbackFor("http-probe")).toEqual(["super-curl","curl","fail"]); });
  it("fallbackFor('browser')",    () => { expect(fallbackFor("browser")).toEqual(["surf-cli","playwright","raw-cdp","fail"]); });
  it("fallbackFor('recall')",     () => { expect(fallbackFor("recall")).toEqual(["graphify","grep-events","no-recall"]); });
  it("fallbackFor('mcp')",        () => { expect(fallbackFor("mcp")).toEqual(["pi-mcp-adapter","direct-mcp","fail"]); });
  it("promptInstall returns skipped:true on 's'", async () => {
    const ask = vi.fn(async () => "s");
    const result = await promptInstall(KNOWN_SOFT_DEPS.slice(0,1), { ask });
    expect(result.skipped).toBe(true);
    expect(ask).toHaveBeenCalledOnce();
  });
  it("promptInstall declines all on 'n'", async () => {
    const ask = vi.fn(async () => "n");
    const result = await promptInstall(KNOWN_SOFT_DEPS.slice(0,2), { ask });
    expect(result.skipped).toBe(false);
    expect(result.declined.length).toBe(2);
  });
  it("promptInstall no-op on empty deps", async () => {
    const ask = vi.fn(async () => "y");
    const result = await promptInstall([], { ask });
    expect(ask).not.toHaveBeenCalled();
    expect(result).toEqual({ installed: [], declined: [], skipped: false });
  });
});
