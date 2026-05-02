import { describe, it, expect } from "vitest";
import { validateVerifierResult } from "../extensions/pi-vibehack/hooks/tool-result.ts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("validateVerifierResult", () => {
  it("emits verification_pass when verified=true AND screenshot exists with non-zero size", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-bv-"));
    try {
      const ssPath = path.join(tmp, "ss.png");
      fs.writeFileSync(ssPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      const result = validateVerifierResult(
        { verified: true, screenshot_ref: ssPath, dom_assertion_ref: "x", console_log_ref: "y" },
        { node_id: "n1", kind: "DOM-XSS", engagement_id: "eng-1" }
      );
      expect(result.event.event).toBe("verification_pass");
      expect(result.event.node_id).toBe("n1");
      expect(result.event.engagement_id).toBe("eng-1");
      expect(result.event.evidence_ref).toBe(ssPath);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("emits verification_advisory when verified=true but screenshot missing", () => {
    const result = validateVerifierResult(
      { verified: true, screenshot_ref: "/nonexistent/missing.png", dom_assertion_ref: "x", console_log_ref: "y" },
      { node_id: "n1", kind: "DOM-XSS", engagement_id: "eng-1" }
    );
    expect(result.event.event).toBe("verification_advisory");
    expect(result.event.message).toMatch(/screenshot/i);
  });

  it("emits verification_advisory when screenshot exists but has zero size", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-bv-"));
    try {
      const ssPath = path.join(tmp, "empty.png");
      fs.writeFileSync(ssPath, "");
      const result = validateVerifierResult(
        { verified: true, screenshot_ref: ssPath, dom_assertion_ref: "x", console_log_ref: "y" },
        { node_id: "n1", kind: "DOM-XSS", engagement_id: "eng-1" }
      );
      expect(result.event.event).toBe("verification_advisory");
      expect(result.event.message).toMatch(/screenshot/i);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("emits verification_fail when verified=false", () => {
    const result = validateVerifierResult(
      { verified: false, screenshot_ref: "x", dom_assertion_ref: "x", console_log_ref: "x", reason: "no alert dialog observed" },
      { node_id: "n1", kind: "DOM-XSS", engagement_id: "eng-1" }
    );
    expect(result.event.event).toBe("verification_fail");
    expect(result.event.reason).toBe("no alert dialog observed");
  });

  it("emits verification_advisory when verified is undefined/ambiguous", () => {
    const result = validateVerifierResult(
      { screenshot_ref: "x" } as any,
      { node_id: "n1", kind: "DOM-XSS", engagement_id: "eng-1" }
    );
    expect(result.event.event).toBe("verification_advisory");
    expect(result.event.message).toMatch(/ambiguous|unknown/i);
  });

  it("emitted events use event: discriminator + engagement_id (Phase 5 envelope)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-bv-"));
    try {
      const ssPath = path.join(tmp, "ss.png");
      fs.writeFileSync(ssPath, Buffer.from([0x89]));
      const result = validateVerifierResult(
        { verified: true, screenshot_ref: ssPath, dom_assertion_ref: "x", console_log_ref: "y" },
        { node_id: "n1", kind: "DOM-XSS", engagement_id: "eng-1" }
      );
      expect("event" in result.event).toBe(true);
      expect("type" in result.event).toBe(false);
      expect(result.event.engagement_id).toBe("eng-1");
      expect(result.event.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
