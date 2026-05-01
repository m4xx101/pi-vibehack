import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addPackage, removePackage, readSettings } from "../bin/lib/settings.js";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(join(tmpdir(), "vibehack-test-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("settings.json patcher", () => {
  it("creates settings.json if missing and adds a package", async () => {
    const path = join(tmp, "settings.json");
    await addPackage(path, "npm:@m4xx101/pi-vibehack@1.0.0");
    const s = await readSettings(path);
    expect(s.packages).toContain("npm:@m4xx101/pi-vibehack@1.0.0");
  });

  it("is idempotent — adding the same package twice yields one entry", async () => {
    const path = join(tmp, "settings.json");
    await addPackage(path, "npm:@m4xx101/pi-vibehack@1.0.0");
    await addPackage(path, "npm:@m4xx101/pi-vibehack@1.0.0");
    const s = await readSettings(path);
    expect(s.packages.filter((p: string) => p.startsWith("npm:@m4xx101/pi-vibehack")).length).toBe(1);
  });

  it("preserves other keys when patching", async () => {
    const path = join(tmp, "settings.json");
    await fs.writeFile(path, JSON.stringify({ theme: "dark", apiKeys: { anthropic: "sk-x" } }, null, 2));
    await addPackage(path, "npm:@m4xx101/pi-vibehack@1.0.0");
    const s = await readSettings(path);
    expect(s.theme).toBe("dark");
    expect(s.apiKeys.anthropic).toBe("sk-x");
    expect(s.packages).toContain("npm:@m4xx101/pi-vibehack@1.0.0");
  });

  it("removePackage removes the matching entry", async () => {
    const path = join(tmp, "settings.json");
    await addPackage(path, "npm:@m4xx101/pi-vibehack@1.0.0");
    await addPackage(path, "npm:pi-dcp@1.0.0");
    await removePackage(path, /^npm:@m4xx101\/pi-vibehack/);
    const s = await readSettings(path);
    expect(s.packages.some((p: string) => p.startsWith("npm:@m4xx101/pi-vibehack"))).toBe(false);
    expect(s.packages).toContain("npm:pi-dcp@1.0.0");
  });

  it("replaces an older version when adding a newer one (version-replace)", async () => {
    const path = join(tmp, "settings.json");
    await addPackage(path, "npm:@m4xx101/pi-vibehack@1.0.0");
    await addPackage(path, "npm:@m4xx101/pi-vibehack@1.0.1");
    const s = await readSettings(path);
    expect(s.packages).toEqual(["npm:@m4xx101/pi-vibehack@1.0.1"]);
  });

  it("rejects unversioned scoped specs (foot-gun guard)", async () => {
    const path = join(tmp, "settings.json");
    await expect(addPackage(path, "npm:@m4xx101/pi-vibehack")).rejects.toThrow(/versioned spec/);
  });

  it("does not nuke unrelated scoped packages when adding another scoped spec", async () => {
    const path = join(tmp, "settings.json");
    await addPackage(path, "npm:@scope-a/foo@1.0.0");
    await addPackage(path, "npm:@scope-b/bar@2.0.0");
    const s = await readSettings(path);
    expect(s.packages).toContain("npm:@scope-a/foo@1.0.0");
    expect(s.packages).toContain("npm:@scope-b/bar@2.0.0");
    expect(s.packages.length).toBe(2);
  });
});
