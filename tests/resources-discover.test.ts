import { describe, it, expect } from "vitest";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { computeResourcePaths } from "../extensions/pi-vibehack/hooks/resources-discover.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..");

describe("resources_discover handler", () => {
  it("returns the bundled skills + prompts directories", () => {
    const out = computeResourcePaths();
    expect(out.skillPaths).toContain(join(PKG_ROOT, "skills"));
    expect(out.promptPaths).toContain(join(PKG_ROOT, "prompts"));
  });

  it("registerResourcesDiscoverHook installs a resources_discover handler", async () => {
    const { registerResourcesDiscoverHook } = await import(
      "../extensions/pi-vibehack/hooks/resources-discover.ts"
    );
    const calls: Array<{ event: string }> = [];
    let captured: Function | null = null;
    const fakePi: any = {
      on: (event: string, handler: Function) => {
        calls.push({ event });
        if (event === "resources_discover") captured = handler;
      },
    };
    registerResourcesDiscoverHook(fakePi);
    expect(calls.find((c) => c.event === "resources_discover")).toBeDefined();
    const result = await captured!({}, {});
    expect(Array.isArray(result.skillPaths)).toBe(true);
    expect(Array.isArray(result.promptPaths)).toBe(true);
    expect(result.skillPaths.some((p: string) => p.endsWith("skills"))).toBe(true);
    expect(result.promptPaths.some((p: string) => p.endsWith("prompts"))).toBe(true);
  });
});
