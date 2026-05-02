// extensions/pi-vibehack/lib/evolve.ts
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

// Cross-platform exec for .sh scripts: on win32, route through `sh` so they
// run under Git Bash / WSL sh.exe instead of being handed to cmd.exe (which
// rejects them with EFTYPE).
function execScriptSync(script: string, timeout: number) {
  if (process.platform === "win32" && script.endsWith(".sh")) {
    execFileSync("sh", [script], { stdio: "inherit", timeout });
  } else {
    execFileSync(script, [], { stdio: "inherit", timeout });
  }
}
import * as YAML from "yaml";
import { evaluateBench, type ExpectedFindingsFile, type EvalResult, type ActualFinding } from "./evaluator.ts";

export interface RunBenchOpts {
  benchDir: string;
  runEngagement: (target: string) => Promise<ActualFinding[]>;
  mutate?: boolean;  // Phase 8 — ignored in Phase 7
}

export async function runBench(opts: RunBenchOpts): Promise<EvalResult> {
  const expectedPath = path.join(opts.benchDir, "expected-findings.yaml");
  if (!fs.existsSync(expectedPath)) {
    throw new Error(`bench: expected-findings.yaml not found at ${expectedPath}`);
  }
  const expected: ExpectedFindingsFile = YAML.parse(fs.readFileSync(expectedPath, "utf8"));

  const upScript = path.join(opts.benchDir, "up.sh");
  const downScript = path.join(opts.benchDir, "down.sh");
  if (!fs.existsSync(upScript) || !fs.existsSync(downScript)) {
    throw new Error(`bench: up.sh or down.sh missing in ${opts.benchDir}`);
  }

  let result: EvalResult;
  let upError: Error | null = null;
  try {
    // 60s ready-poll cap (per spec §3.1 risk)
    execScriptSync(upScript, 60_000);
    const actual = await opts.runEngagement(expected.target ?? "");
    result = evaluateBench(expected, actual);
  } catch (e) {
    upError = e as Error;
    result = { passed: false, matched: [], missing: ["bench-up-failed"], extras: [] };
  } finally {
    try { execScriptSync(downScript, 30_000); } catch {}
  }

  // Always write a results report (even on up.sh failure)
  const resultsDir = path.join(opts.benchDir, "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(resultsDir, `${timestamp}.md`);
  fs.writeFileSync(reportPath, renderReport(result, upError), "utf8");

  if (upError) throw upError;
  return result;
}

function renderReport(r: EvalResult, upError: Error | null): string {
  const lines = [
    `# Bench result`,
    ``,
    `- passed: ${r.passed}`,
    `- matched: ${r.matched.length}`,
    `- missing: ${r.missing.length === 0 ? "(none)" : r.missing.join(", ")}`,
    `- extras: ${r.extras.length}`,
  ];
  if (upError) {
    lines.push(``, `## up.sh error`, ``, "```", upError.message, "```");
  }
  if (r.matched.length > 0) {
    lines.push(``, `## Matched`);
    for (const m of r.matched) lines.push(`- \`${m.kind}\`${m.surface ? ` @ \`${m.surface}\`` : ""}${m.severity ? ` (${m.severity})` : ""}`);
  }
  if (r.extras.length > 0) {
    lines.push(``, `## Extras (not in expected)`);
    for (const e of r.extras) lines.push(`- \`${e.kind}\`${e.surface ? ` @ \`${e.surface}\`` : ""}`);
  }
  return lines.join("\n") + "\n";
}
