// vibehack_report_vuln (v1.3, CyberStrike-inspired).
//
// CyberStrike emits HackerOne-format vulnerability reports with severity, PoC,
// affected URL, and impact analysis. Bug-bounty hunters then ship those reports
// directly. We mirror that here: the Planner calls this tool when a finding is
// confirmed and exploitable; we generate a markdown file at
// engagements/<id>/vulns/<node_id>.md and emit a typed vuln_reported event.
//
// The markdown layout follows the de-facto HackerOne / Bugcrowd structure:
// - Summary (one-paragraph)
// - Severity (with optional CVSS 3.1 score)
// - Affected URL
// - Impact
// - Steps to Reproduce
// - Evidence (paths to files in the engagement workspace)
// - References (OWASP / CWE)

import { Type } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { appendEvent, nowIso } from "../lib/events.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

export const reportVulnSchema = Type.Object({
  node_id: Type.String(),
  title: Type.String({ minLength: 5 }),
  severity: Type.Union(SEVERITIES.map((s) => Type.Literal(s))),
  cvss: Type.Optional(Type.Number({ minimum: 0, maximum: 10 })),
  affected_url: Type.String(),
  impact: Type.String({ minLength: 10 }),
  reproduction_steps: Type.Array(Type.String(), { minItems: 1 }),
  evidence_paths: Type.Optional(Type.Array(Type.String())),
  owasp: Type.Optional(Type.String()),
  cwe: Type.Optional(Type.String()),
}, { additionalProperties: false });

function buildMarkdown(p: any, engId: string): string {
  const cvssLine = p.cvss !== undefined ? ` (CVSS ${p.cvss.toFixed(1)})` : "";
  const evidence = (p.evidence_paths ?? []).map((e: string) => `- \`${e}\``).join("\n") || "_(none attached)_";
  const refs: string[] = [];
  if (p.owasp) refs.push(`- OWASP: ${p.owasp}`);
  if (p.cwe) refs.push(`- CWE: ${p.cwe}`);
  return [
    `# ${p.title}`,
    "",
    `**Severity:** ${p.severity}${cvssLine}`,
    `**Affected URL:** ${p.affected_url}`,
    `**Engagement:** ${engId}`,
    `**Node:** ${p.node_id}`,
    `**Reported:** ${nowIso()}`,
    "",
    "## Summary",
    "",
    p.impact,
    "",
    "## Impact",
    "",
    p.impact,
    "",
    "## Steps to Reproduce",
    "",
    ...p.reproduction_steps.map((s: string, i: number) => `${i + 1}. ${s}`),
    "",
    "## Evidence",
    "",
    evidence,
    "",
    refs.length ? "## References\n\n" + refs.join("\n") + "\n" : "",
  ].filter(Boolean).join("\n");
}

export const reportVulnTool = {
  name: "vibehack_report_vuln",
  label: "Report a confirmed vulnerability",
  description:
    "Emit a structured vulnerability report (HackerOne-format markdown) and a vuln_reported event. " +
    "Call only after a finding is confirmed and reproducible.",
  parameters: reportVulnSchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, {
      nodeId: "node_id",
      url: "affected_url",
      affectedUrl: "affected_url",
      affected: "affected_url",
      steps: "reproduction_steps",
      reproduction: "reproduction_steps",
      repro: "reproduction_steps",
      evidence: "evidence_paths",
      cvssScore: "cvss",
      score: "cvss",
    }),
  ) as any,

  async execute(
    _callId: string,
    params: any,
    _signal?: any,
    _onUpdate?: any,
    ctx?: { hasUI?: boolean; ui?: { confirm?: (t: string, m: string, opts?: any) => Promise<boolean> } },
  ): Promise<any> {
    const eng = await activeEngagementId();
    if (!eng) return { error: "no active engagement" };
    // v1.4: parity with canary-verify — gate the write behind ctx.ui.confirm
    // when a UI is attached. The vuln markdown is small but a "report" is a
    // commitment (it shows up in /resume + downstream pipelines), so the
    // operator should sign off on critical/high reports. Print/RPC mode skips.
    if (ctx?.hasUI && typeof ctx.ui?.confirm === "function") {
      const big = params.severity === "critical" || params.severity === "high";
      if (big) {
        let ok = false;
        try {
          ok = !!(await ctx.ui.confirm(
            `Report ${params.severity.toUpperCase()} vuln?`,
            `${params.title} on ${params.affected_url}`,
            { timeout: 60_000 } as any,
          ));
        } catch { ok = false; }
        if (!ok) return { error: "user-blocked", title: params.title };
      }
    }
    const dir = engagementDir(eng);
    const vulnsDir = join(dir, "vulns");
    await fs.mkdir(vulnsDir, { recursive: true });
    const reportPath = join(vulnsDir, `${params.node_id}.md`);
    const md = buildMarkdown(params, eng);
    await fs.writeFile(reportPath, md, "utf8");

    try {
      await appendEvent(dir, {
        ts: nowIso(),
        engagement_id: eng,
        event: "vuln_reported",
        node_id: params.node_id,
        vuln: {
          title: params.title,
          severity: params.severity,
          cvss: params.cvss,
          affected_url: params.affected_url,
          impact: params.impact,
          reproduction_steps: params.reproduction_steps,
          evidence_paths: params.evidence_paths ?? [],
          owasp: params.owasp,
          cwe: params.cwe,
          report_path: reportPath,
        },
      } as any);
    } catch (e: any) {
      // event-schema may reject if minor field missing; report file is the
      // canonical artifact regardless.
      return { report_path: reportPath, schema_warning: String(e?.message ?? e) };
    }

    return { report_path: reportPath, severity: params.severity };
  },
};
