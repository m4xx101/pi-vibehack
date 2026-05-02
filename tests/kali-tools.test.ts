import { describe, it, expect, vi } from "vitest";
import {
  KALI_TOOLS,
  detectKaliCapabilities,
  loadCachedCapabilities,
  saveCachedCapabilities,
  type CapEntry,
} from "../extensions/pi-vibehack/lib/kali-tools.ts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("KALI_TOOLS catalog", () => {
  it("has 8 expected categories", () => {
    expect(Object.keys(KALI_TOOLS).sort()).toEqual([
      "crack", "exploit", "forensic", "misc", "mobile", "network", "recon", "web_api",
    ]);
  });

  it("has at least 70 tools total (~80 per spec)", () => {
    const total = Object.values(KALI_TOOLS).flat().length;
    expect(total).toBeGreaterThanOrEqual(70);
    expect(total).toBeLessThanOrEqual(100);
  });

  it("recon includes documented tools", () => {
    expect(KALI_TOOLS.recon).toContain("nmap");
    expect(KALI_TOOLS.recon).toContain("subfinder");
    expect(KALI_TOOLS.recon).toContain("nuclei");
  });

  it("exploit includes sqlmap and metasploit", () => {
    expect(KALI_TOOLS.exploit).toContain("sqlmap");
    expect(KALI_TOOLS.exploit).toContain("metasploit-framework");
  });

  it("crack includes hashcat and john", () => {
    expect(KALI_TOOLS.crack).toContain("hashcat");
    expect(KALI_TOOLS.crack).toContain("john");
  });
});

describe("detectKaliCapabilities", () => {
  it("returns map of tool → CapEntry with available bool", () => {
    const fakeWhich = vi.fn((cmd: string) => cmd === "nmap" ? "/usr/bin/nmap" : null);
    const caps = detectKaliCapabilities({ which: fakeWhich });
    expect(caps.nmap.available).toBe(true);
    expect(caps.nmap.path).toBe("/usr/bin/nmap");
    expect(caps.nmap.category).toBe("recon");
    expect(caps.sqlmap.available).toBe(false);
    expect(caps.sqlmap.path).toBeNull();
  });

  it("respects all 8 categories", () => {
    const fakeWhich = vi.fn(() => null);
    const caps = detectKaliCapabilities({ which: fakeWhich });
    const cats = new Set(Object.values(caps).map(c => c.category));
    expect(cats.size).toBe(8);
  });
});

describe("loadCachedCapabilities / saveCachedCapabilities", () => {
  it("returns null on missing file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cap-"));
    expect(loadCachedCapabilities(path.join(tmp, "missing.json"))).toBeNull();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("save+load round-trips", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cap-"));
    const filePath = path.join(tmp, ".capabilities.json");
    const caps: Record<string, CapEntry> = {
      nmap: { path: "/usr/bin/nmap", category: "recon", available: true },
    };
    saveCachedCapabilities(filePath, caps);
    const loaded = loadCachedCapabilities(filePath);
    expect(loaded).not.toBeNull();
    expect(loaded!.nmap.available).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("returns null on malformed json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cap-"));
    const filePath = path.join(tmp, "bad.json");
    fs.writeFileSync(filePath, "{ not valid json");
    expect(loadCachedCapabilities(filePath)).toBeNull();
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
