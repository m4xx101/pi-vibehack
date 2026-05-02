import { describe, it, expect } from "vitest";
import {
  plantFileCanary,
  plantHttpCallbackCanary,
  verifyCanary,
  cleanupCanaries,
} from "../extensions/pi-vibehack/lib/canary.ts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("plantFileCanary", () => {
  it("writes UUID-tagged file with secret content", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      const c = plantFileCanary(tmp, "RCE");
      expect(c.uuid).toMatch(/^[0-9a-f-]{36}$/i);
      expect(c.kind).toBe("filesystem");
      expect(fs.existsSync(c.ref)).toBe(true);
      const content = fs.readFileSync(c.ref, "utf8");
      expect(content).toContain(c.uuid);
      expect(content).toContain(c.secret);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("creates evidence/ subdir if missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      const c = plantFileCanary(tmp, "AFR");
      expect(fs.existsSync(path.join(tmp, "evidence"))).toBe(true);
      expect(c.ref.startsWith(path.join(tmp, "evidence"))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("each call generates unique UUID + secret", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      const c1 = plantFileCanary(tmp, "RCE");
      const c2 = plantFileCanary(tmp, "RCE");
      expect(c1.uuid).not.toBe(c2.uuid);
      expect(c1.secret).not.toBe(c2.secret);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("plantHttpCallbackCanary", () => {
  it("starts ephemeral HTTP listener and returns callback_url", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      const c = await plantHttpCallbackCanary(tmp);
      expect(c.uuid).toMatch(/^[0-9a-f-]{36}$/i);
      expect(c.kind).toBe("http-callback");
      expect(c.callback_url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
      expect(c.port).toBeGreaterThan(0);
      await cleanupCanaries(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("listener accepts callbacks and logs to JSONL", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      const c = await plantHttpCallbackCanary(tmp);
      await fetch(c.callback_url + "?test=1");
      await new Promise((r) => setTimeout(r, 100));
      const logPath = path.join(tmp, "evidence", `canary-${c.uuid}-callbacks.jsonl`);
      expect(fs.existsSync(logPath)).toBe(true);
      const content = fs.readFileSync(logPath, "utf8").trim();
      const entries = content.split("\n").map((l) => JSON.parse(l));
      expect(entries.length).toBeGreaterThanOrEqual(1);
      expect(entries[0].url).toMatch(/test=1/);
      await cleanupCanaries(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("verifyCanary", () => {
  it("returns verified=false on un-retrieved http-callback canary", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      const c = await plantHttpCallbackCanary(tmp);
      const v = verifyCanary(c);
      expect(v.verified).toBe(false);
      await cleanupCanaries(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns verified=true after http-callback hit", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      const c = await plantHttpCallbackCanary(tmp);
      await fetch(c.callback_url + "?probe=1");
      await new Promise((r) => setTimeout(r, 100));
      const v = verifyCanary(c);
      expect(v.verified).toBe(true);
      expect(v.evidence_ref).toBeDefined();
      await cleanupCanaries(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("filesystem canary verifyCanary returns false (operator cross-check needed)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      const c = plantFileCanary(tmp, "RCE");
      const v = verifyCanary(c);
      expect(v.verified).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("cleanupCanaries", () => {
  it("stops all HTTP listeners and is idempotent", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-can-"));
    try {
      await plantHttpCallbackCanary(tmp);
      await plantHttpCallbackCanary(tmp);
      await cleanupCanaries(tmp);
      await cleanupCanaries(tmp);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
