// v1.3 integration smoke tests — verify the actual end-to-end wiring, not
// just unit shapes. These cover the gaps in the initial v1.3 unit tests:
// 1. Does the active persona body actually land in before-agent-start's
//    system prompt return?
// 2. Does vibehack_report_vuln actually append to events.jsonl with the right
//    schema?
// 3. Does /vibehack-auto write a steer that before-agent-start consumes on
//    the next turn?

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("v1.3 — persona body reaches systemPrompt at before-agent-start", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-int-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("ssrf persona body shows up inside the returned systemPrompt", async () => {
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { setActivePersona } =
      await import("../extensions/pi-vibehack/lib/persona-registry.ts");
    const { registerBeforeAgentStartHook } =
      await import("../extensions/pi-vibehack/hooks/before-agent-start.ts");

    const eng = newEngagementId("integration-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
    await setActivePersona(eng, "ssrf");

    let captured: any = null;
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "before_agent_start") captured = h; },
      setActiveTools: () => {},
    };
    registerBeforeAgentStartHook(fakePi);
    expect(captured).toBeTruthy();

    const ctx: any = { ui: { notify: () => {} } };
    const result: any = await captured({ systemPrompt: "BASE" }, ctx);

    expect(result?.systemPrompt).toBeDefined();
    expect(result.systemPrompt).toContain("BASE");
    // The actual persona body marker:
    expect(result.systemPrompt).toContain("<persona name=ssrf>");
    expect(result.systemPrompt).toContain("169.254.169.254");
  });

  it("general persona is a no-op (empty body) — system prompt unchanged by persona block", async () => {
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { setActivePersona } =
      await import("../extensions/pi-vibehack/lib/persona-registry.ts");
    const { registerBeforeAgentStartHook } =
      await import("../extensions/pi-vibehack/hooks/before-agent-start.ts");

    const eng = newEngagementId("general-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
    await setActivePersona(eng, "general");

    let captured: any = null;
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "before_agent_start") captured = h; },
      setActiveTools: () => {},
    };
    registerBeforeAgentStartHook(fakePi);
    const ctx: any = { ui: { notify: () => {} } };
    const result: any = await captured({ systemPrompt: "BASE" }, ctx);
    // No <persona name=...> marker should appear because general body is empty
    expect(result.systemPrompt ?? "").not.toMatch(/<persona name=/);
  });
});

describe("v1.3 — vibehack_report_vuln actually appends to events.jsonl", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-vuln-int-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("appends a schema-valid vuln_reported entry to engagements/<id>/events.jsonl", async () => {
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { reportVulnTool } = await import("../extensions/pi-vibehack/tools/report-vuln.ts");
    const eng = newEngagementId("vuln-target");
    const dir = engagementDir(eng);
    await fs.mkdir(dir, { recursive: true });
    await setActiveEngagement(eng);

    const r: any = await (reportVulnTool as any).execute("cid", {
      node_id: "n_1a",
      title: "SSRF on /fetch?url=",
      severity: "critical",
      cvss: 9.1,
      affected_url: "https://api.example.com/fetch",
      impact: "Unauthenticated SSRF allowing IMDS access and AWS credential theft.",
      reproduction_steps: ["GET /fetch?url=http://169.254.169.254/latest/meta-data/", "Observe instance role JSON"],
      evidence_paths: [],
      owasp: "A10:2021",
      cwe: "CWE-918",
    });
    expect(r.report_path).toBeTruthy();
    expect(r.schema_warning).toBeUndefined();

    // Verify events.jsonl actually contains the row.
    const jsonl = await fs.readFile(join(dir, "events.jsonl"), "utf8");
    const rows = jsonl.trim().split("\n").map((l) => JSON.parse(l));
    const vulnRows = rows.filter((row: any) => row.event === "vuln_reported");
    expect(vulnRows.length).toBe(1);
    expect(vulnRows[0].vuln.severity).toBe("critical");
    expect(vulnRows[0].vuln.cvss).toBe(9.1);
    expect(vulnRows[0].vuln.cwe).toBe("CWE-918");
    expect(vulnRows[0].node_id).toBe("n_1a");
  });
});

describe("v1.3 — /vibehack-auto steer is consumed at next before-agent-start", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-auto-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("appendSteer payload appears as <operator_steer> block in the next systemPrompt", async () => {
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { appendSteer } = await import("../extensions/pi-vibehack/lib/pending-steer.ts");
    const { registerBeforeAgentStartHook } =
      await import("../extensions/pi-vibehack/hooks/before-agent-start.ts");

    const eng = newEngagementId("auto-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
    await appendSteer(eng, "<auto_mode depth=5>...halt only when all open nodes done</auto_mode>");

    let captured: any = null;
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "before_agent_start") captured = h; },
      setActiveTools: () => {},
    };
    registerBeforeAgentStartHook(fakePi);
    const ctx: any = { ui: { notify: () => {} } };
    const result: any = await captured({ systemPrompt: "BASE" }, ctx);

    expect(result.systemPrompt).toContain("<auto_mode depth=5>");
    expect(result.systemPrompt).toContain("<operator_steer>");
  });
});
