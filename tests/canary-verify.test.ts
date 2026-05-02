import { describe, it, expect, afterEach } from "vitest";
import { canaryVerifyTool } from "../extensions/pi-vibehack/tools/canary-verify.ts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { _cleanupAllListeners } from "../extensions/pi-vibehack/lib/canary.ts";

afterEach(async () => {
  await _cleanupAllListeners();
});

describe("vibehack_canary_verify tool", () => {
  it("schema specifies node_id (string) and kind (enum of 6)", () => {
    expect(canaryVerifyTool.schema.properties.node_id).toBeDefined();
    expect(canaryVerifyTool.schema.properties.kind.enum).toEqual([
      "RCE", "AFR", "SSRF", "blind-OOB", "open-redirect", "DNS",
    ]);
    expect(canaryVerifyTool.schema.additionalProperties).toBe(false);
    expect(canaryVerifyTool.schema.required).toEqual(["node_id", "kind"]);
  });

  it("tool name is vibehack_canary_verify", () => {
    expect(canaryVerifyTool.name).toBe("vibehack_canary_verify");
  });

  it("RCE plants filesystem canary, returns metadata + appends canary_planted event (Phase 5 envelope)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cv-"));
    try {
      const eventsPath = path.join(tmp, "events.jsonl");
      fs.writeFileSync(eventsPath, "");
      const result = await canaryVerifyTool.handler(
        { node_id: "n1", kind: "RCE" },
        { engagementDir: tmp, eventsPath, engagement_id: "eng-1" },
      );
      expect(result.uuid).toBeDefined();
      expect(result.kind).toBe("filesystem");
      expect(result.secret).toBeDefined();

      const events = fs
        .readFileSync(eventsPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l));
      const planted = events.find((e: any) => e.event === "canary_planted");
      expect(planted).toBeDefined();
      expect(planted.engagement_id).toBe("eng-1");
      expect(planted.node_id).toBe("n1");
      expect(planted.canary_kind).toBe("filesystem");
      expect(planted.uuid).toBeDefined();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("AFR plants filesystem canary (same as RCE)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cv-"));
    try {
      const eventsPath = path.join(tmp, "events.jsonl");
      fs.writeFileSync(eventsPath, "");
      const result = await canaryVerifyTool.handler(
        { node_id: "n1", kind: "AFR" },
        { engagementDir: tmp, eventsPath, engagement_id: "eng-1" },
      );
      expect(result.kind).toBe("filesystem");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("SSRF plants http-callback canary", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cv-"));
    try {
      const eventsPath = path.join(tmp, "events.jsonl");
      fs.writeFileSync(eventsPath, "");
      const result = await canaryVerifyTool.handler(
        { node_id: "n1", kind: "SSRF" },
        { engagementDir: tmp, eventsPath, engagement_id: "eng-1" },
      );
      expect(result.kind).toBe("http-callback");
      expect(result.callback_url).toMatch(/^http:/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("open-redirect plants http-callback canary", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cv-"));
    try {
      const eventsPath = path.join(tmp, "events.jsonl");
      fs.writeFileSync(eventsPath, "");
      const result = await canaryVerifyTool.handler(
        { node_id: "n1", kind: "open-redirect" },
        { engagementDir: tmp, eventsPath, engagement_id: "eng-1" },
      );
      expect(result.kind).toBe("http-callback");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("DNS without pinned collector returns error", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cv-"));
    try {
      fs.writeFileSync(path.join(tmp, "events.jsonl"), "");
      const result = await canaryVerifyTool.handler(
        { node_id: "n1", kind: "DNS" },
        {
          engagementDir: tmp,
          eventsPath: path.join(tmp, "events.jsonl"),
          engagement_id: "eng-1",
          pinnedCollector: null,
        },
      );
      expect(result.error).toMatch(/no OOB collector pinned/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("DNS with pinned collector returns subdomain + emits canary_planted with dns kind", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cv-"));
    try {
      fs.writeFileSync(path.join(tmp, "events.jsonl"), "");
      const result = await canaryVerifyTool.handler(
        { node_id: "n1", kind: "DNS" },
        {
          engagementDir: tmp,
          eventsPath: path.join(tmp, "events.jsonl"),
          engagement_id: "eng-1",
          pinnedCollector: "https://example.oast.fun",
        },
      );
      expect(result.kind).toBe("dns");
      expect(result.subdomain).toMatch(/oast\.fun$/);
      const events = fs
        .readFileSync(path.join(tmp, "events.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      const planted = events.find((e: any) => e.event === "canary_planted");
      expect(planted.canary_kind).toBe("dns");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("blind-OOB without pinned collector returns error", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-cv-"));
    try {
      fs.writeFileSync(path.join(tmp, "events.jsonl"), "");
      const result = await canaryVerifyTool.handler(
        { node_id: "n1", kind: "blind-OOB" },
        {
          engagementDir: tmp,
          eventsPath: path.join(tmp, "events.jsonl"),
          engagement_id: "eng-1",
          pinnedCollector: null,
        },
      );
      expect(result.error).toMatch(/no OOB collector/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
