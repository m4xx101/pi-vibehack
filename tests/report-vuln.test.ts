// v1.3 Phase B — vibehack_report_vuln tool.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("vibehack_report_vuln tool", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-vuln-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
    // Bootstrap an engagement.
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const eng = newEngagementId("test-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("writes a HackerOne-format markdown report under engagements/<id>/vulns/", async () => {
    const { reportVulnTool } = await import("../extensions/pi-vibehack/tools/report-vuln.ts");
    const r: any = await (reportVulnTool as any).execute("cid", {
      node_id: "n_1a",
      title: "Reflected XSS in /search?q=",
      severity: "high",
      cvss: 7.4,
      affected_url: "https://example.com/search",
      impact: "An attacker can execute arbitrary JavaScript in the victim's browser, leading to session theft.",
      reproduction_steps: ["GET /search?q=<script>alert(1)</script>", "Observe the alert in the rendered page"],
      evidence_paths: ["evidence/n_1a/poc.png"],
      owasp: "A03:2021 — Injection",
      cwe: "CWE-79",
    });
    expect(r.report_path).toMatch(/n_1a\.md$/);
    const md = await fs.readFile(r.report_path, "utf8");
    expect(md).toContain("# Reflected XSS in /search?q=");
    expect(md).toContain("**Severity:** high (CVSS 7.4)");
    expect(md).toContain("CWE-79");
    expect(md).toContain("alert(1)");
  });

  it("normalizes alias args (steps → reproduction_steps, etc.)", async () => {
    const { reportVulnTool } = await import("../extensions/pi-vibehack/tools/report-vuln.ts");
    const out = (reportVulnTool as any).prepareArguments({
      nodeId: "n_x",
      url: "https://x.com",
      steps: ["a", "b"],
      evidence: ["e1"],
      cvssScore: 5.2,
    });
    expect(out.node_id).toBe("n_x");
    expect(out.affected_url).toBe("https://x.com");
    expect(out.reproduction_steps).toEqual(["a", "b"]);
    expect(out.evidence_paths).toEqual(["e1"]);
    expect(out.cvss).toBe(5.2);
  });
});
