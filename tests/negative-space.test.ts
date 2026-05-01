import { describe, it, expect } from "vitest";
import { detectMissingHeaders, detectFilteredPorts, detectMissingDns } from "../extensions/pi-vibehack/lib/negative-space.ts";

describe("detectMissingHeaders", () => {
  it("flags missing CSP/HSTS/X-Frame-Options/SameSite/Permissions-Policy/Referrer-Policy", () => {
    const headers = { "content-type": "text/html" };
    const findings = detectMissingHeaders(headers);
    expect(findings.length).toBe(6);
    expect(findings.map((f) => f.header).sort()).toEqual([
      "content-security-policy",
      "permissions-policy",
      "referrer-policy",
      "set-cookie:samesite",
      "strict-transport-security",
      "x-frame-options",
    ]);
  });

  it("returns nothing when all headers present", () => {
    const findings = detectMissingHeaders({
      "content-security-policy": "default-src 'self'",
      "strict-transport-security": "max-age=31536000",
      "x-frame-options": "DENY",
      "set-cookie": "id=x; SameSite=Strict",
      "permissions-policy": "geolocation=()",
      "referrer-policy": "no-referrer",
    });
    expect(findings.length).toBe(0);
  });
});

describe("detectFilteredPorts", () => {
  it("flags well-known ports missing from nmap result set", () => {
    const open = new Set([80, 443]);
    const findings = detectFilteredPorts(open);
    expect(findings.some((f) => f.port === 22)).toBe(true);
    expect(findings.some((f) => f.port === 80)).toBe(false);
  });
});

describe("detectMissingDns", () => {
  it("flags missing SPF / DMARC / DKIM", () => {
    const findings = detectMissingDns({ MX: ["mx.example."], TXT: ["v=spf1 -all"] });
    expect(findings.some((f) => f.kind === "DMARC")).toBe(true);
    expect(findings.some((f) => f.kind === "DKIM")).toBe(true);
    expect(findings.some((f) => f.kind === "SPF")).toBe(false);
  });
});
