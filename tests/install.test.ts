import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addPackage, removePackage, readSettings } from "../bin/lib/settings.js";
import { ensureDataDir, vibehackDir, writeProfile, readProfile } from "../bin/lib/data-dir.js";

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

describe("data dir bootstrap", () => {
  it("creates skeleton dirs and files idempotently", async () => {
    const dir = join(tmp, "vibehack");
    await ensureDataDir(dir);
    await ensureDataDir(dir); // twice = no-op
    expect(await fs.readFile(join(dir, "lessons.jsonl"), "utf8")).toBe("");
    const stat = await fs.stat(join(dir, "engagements"));
    expect(stat.isDirectory()).toBe(true);
  });

  it("writeProfile + readProfile roundtrips", async () => {
    const dir = join(tmp, "vibehack");
    await ensureDataDir(dir);
    await writeProfile(dir, { profile: "hybrid", planner: "x", operator: "y", reporter: "z" });
    const r = await readProfile(dir);
    expect(r.planner).toBe("x");
  });

  it("preserves hand-edited AGENTS.md content across reinstall (load-bearing idempotency)", async () => {
    const dir = join(tmp, "vibehack");
    await ensureDataDir(dir);
    await fs.writeFile(join(dir, "AGENTS.md"), "user-pinned content", "utf8");
    await ensureDataDir(dir);
    expect(await fs.readFile(join(dir, "AGENTS.md"), "utf8")).toBe("user-pinned content");
  });

  it("preserves hand-edited lessons.jsonl content across reinstall", async () => {
    const dir = join(tmp, "vibehack");
    await ensureDataDir(dir);
    await fs.writeFile(join(dir, "lessons.jsonl"), '{"ts":"x","engagement_id":"e1","situation":"s","action":"a","outcome":"o","confidence":0.9}\n', "utf8");
    await ensureDataDir(dir);
    expect(await fs.readFile(join(dir, "lessons.jsonl"), "utf8")).toMatch(/engagement_id/);
  });

  it("readProfile returns null on missing file silently (no warn)", async () => {
    const dir = join(tmp, "vibehack");
    await ensureDataDir(dir);
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
      const r = await readProfile(dir);
      expect(r).toBeNull();
      expect(warnings).toEqual([]);
    } finally { console.warn = orig; }
  });

  it("readProfile returns null + warns on malformed JSON", async () => {
    const dir = join(tmp, "vibehack");
    await ensureDataDir(dir);
    await fs.writeFile(join(dir, ".profile"), "{this is not json", "utf8");
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
      const r = await readProfile(dir);
      expect(r).toBeNull();
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toMatch(/unreadable/);
    } finally { console.warn = orig; }
  });
});

import { spawnSync } from "node:child_process";

describe("install.js — verify pi present", () => {
  it("exits non-zero with a clear hint when pi is not on PATH", () => {
    const r = spawnSync(process.execPath, ["bin/install.js", "install"], {
      env: { ...process.env, PATH: "" },
      encoding: "utf8",
    });
    expect(r.status).not.toBe(0);
    expect((r.stderr ?? "") + (r.stdout ?? "")).toMatch(/pi.*not on PATH|pi-mono/i);
  });
});
