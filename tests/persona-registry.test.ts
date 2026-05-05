// v1.3 Phase A — specialist persona registry.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("persona registry", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-persona-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("ships the canonical CyberStrike-style domain personas", async () => {
    const { PERSONAS } = await import("../extensions/pi-vibehack/lib/persona-registry.ts");
    for (const need of ["general", "web-application", "mobile-application", "cloud-security", "internal-network", "idor", "ssrf", "injection", "auth-bypass", "mass-assignment", "business-logic", "file-attacks"]) {
      expect(PERSONAS[need]).toBeDefined();
    }
  });

  it("setActivePersona / getActivePersona round-trips", async () => {
    const { setActivePersona, getActivePersona } =
      await import("../extensions/pi-vibehack/lib/persona-registry.ts");
    const eng = "2026-05-05-test";
    const dir = join(tmp, "engagements", eng);
    await fs.mkdir(dir, { recursive: true });
    await setActivePersona(eng, "ssrf");
    const active = await getActivePersona(eng);
    expect(active.name).toBe("ssrf");
    expect(active.domain).toBe("vuln-class");
  });

  it("rejects unknown persona names", async () => {
    const { setActivePersona } = await import("../extensions/pi-vibehack/lib/persona-registry.ts");
    await expect(setActivePersona("eng", "not-a-persona")).rejects.toThrow();
  });

  it("getActivePersona returns 'general' when no marker exists", async () => {
    const { getActivePersona } = await import("../extensions/pi-vibehack/lib/persona-registry.ts");
    const active = await getActivePersona("never-used-engagement");
    expect(active.name).toBe("general");
  });
});

describe("vibehack_use_persona tool", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-up-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("rejects when no engagement is active", async () => {
    const { usePersonaTool } = await import("../extensions/pi-vibehack/tools/use-persona.ts");
    const r: any = await (usePersonaTool as any).execute("c", { name: "ssrf" });
    expect(r.error).toMatch(/no active engagement/);
  });

  it("normalizes alias args (persona → name, reason → rationale)", async () => {
    const { usePersonaTool } = await import("../extensions/pi-vibehack/tools/use-persona.ts");
    const out = (usePersonaTool as any).prepareArguments({ persona: "ssrf", reason: "found IMDS" });
    expect(out.name).toBe("ssrf");
    expect(out.rationale).toBe("found IMDS");
  });
});
