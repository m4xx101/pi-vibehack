// extensions/pi-vibehack/lib/evolve.ts
import * as fs from "fs";
import * as path from "path";
import { execFileSync, execSync } from "child_process";

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
  mutate?: boolean;
  // Phase 8 additions:
  runMutator?: (ctx: FailureContext) => Promise<MutationProposal>;
  vibehackDataDir?: string;
  regressionBenches?: string[];
}

export interface MutationProposal {
  mutation_target: string | null;
  before: string;
  after: string;
  rationale: string;
}

export interface FailureContext {
  missing: string[];
}

export interface MutationLoopOpts {
  benchDir: string;
  vibehackDataDir: string;
  runMutator: (failureContext: FailureContext) => Promise<MutationProposal>;
  runBench: (opts: { benchDir: string; vibehackDataDir: string }) => Promise<EvalResult>;
  regressionBenches: string[];
  failureContext: FailureContext;
}

export interface MutationLoopResult {
  landed: boolean;
  reason?: string;
  proposal?: MutationProposal;
}

const ALLOWED_MUTATION_PREFIXES = ["skills/learned/", "specialists/learned/"];

export async function runMutationLoop(opts: MutationLoopOpts): Promise<MutationLoopResult> {
  const proposal = await opts.runMutator(opts.failureContext);

  if (!proposal.mutation_target) {
    return { landed: false, reason: "mutator declined (no clean single-mutation fix)", proposal };
  }

  const targetNormalized = proposal.mutation_target.replace(/\\/g, "/");
  if (!ALLOWED_MUTATION_PREFIXES.some(p => targetNormalized.startsWith(p))) {
    return { landed: false, reason: `mutation_target outside learned/ territory: ${targetNormalized}`, proposal };
  }
  if (targetNormalized.includes("..") || path.isAbsolute(targetNormalized)) {
    return { landed: false, reason: `mutation_target invalid (traversal/absolute): ${targetNormalized}`, proposal };
  }

  const stamp = Date.now();
  const worktree = `${opts.vibehackDataDir}.mutation-${stamp}`;
  let usedWorktree = false;
  try {
    execSync(`git worktree add ${JSON.stringify(worktree)} -b mutation-${stamp}`, {
      cwd: opts.vibehackDataDir,
      stdio: "pipe",
    });
    usedWorktree = true;
  } catch {
    fs.cpSync(opts.vibehackDataDir, worktree, { recursive: true });
  }

  let landed = false;
  let reason: string | undefined;

  try {
    const targetPath = path.join(worktree, targetNormalized);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, proposal.after, "utf8");

    const target = await opts.runBench({ benchDir: opts.benchDir, vibehackDataDir: worktree });
    if (!target.passed) {
      reason = `target bench still failing post-mutation (missing: ${target.missing.join(", ")})`;
      return { landed: false, reason, proposal };
    }

    for (const regBench of opts.regressionBenches) {
      const r = await opts.runBench({ benchDir: regBench, vibehackDataDir: worktree });
      if (!r.passed) {
        reason = `regression on ${regBench} (missing: ${r.missing.join(", ")})`;
        return { landed: false, reason, proposal };
      }
    }

    const canonicalPath = path.join(opts.vibehackDataDir, targetNormalized);
    fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
    fs.copyFileSync(targetPath, canonicalPath);
    landed = true;
  } finally {
    if (usedWorktree) {
      try {
        execSync(`git worktree remove --force ${JSON.stringify(worktree)}`, {
          cwd: opts.vibehackDataDir,
          stdio: "pipe",
        });
      } catch {
        try { fs.rmSync(worktree, { recursive: true, force: true }); } catch {}
      }
      // Cleanup the branch we created
      try {
        execSync(`git branch -D mutation-${stamp}`, { cwd: opts.vibehackDataDir, stdio: "pipe" });
      } catch {}
    } else {
      try { fs.rmSync(worktree, { recursive: true, force: true }); } catch {}
    }
  }

  return { landed, reason, proposal };
}

function renderMutationReport(r: MutationLoopResult): string {
  const lines = [
    `# Mutation result`,
    ``,
    `- landed: ${r.landed}`,
    `- reason: ${r.reason ?? "(landed)"}`,
  ];
  if (r.proposal) {
    lines.push(``, `## Proposal`, ``, `- target: \`${r.proposal.mutation_target}\``, `- rationale: ${r.proposal.rationale}`);
  }
  return lines.join("\n") + "\n";
}

export async function runBench(opts: RunBenchOpts): Promise<EvalResult> {
  const expectedPath = path.join(opts.benchDir, "expected-findings.yaml");
  if (!fs.existsSync(expectedPath)) {
    throw new Error(`bench: expected-findings.yaml not found at ${expectedPath}`);
  }
  const parsed = YAML.parse(fs.readFileSync(expectedPath, "utf8"));
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`bench: expected-findings.yaml is not a valid object`);
  }
  if (!Array.isArray(parsed.expected_findings)) {
    throw new Error(`bench: expected-findings.yaml missing 'expected_findings' array`);
  }
  const expected: ExpectedFindingsFile = parsed;

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

  if (opts.mutate && !result.passed && opts.runMutator && opts.vibehackDataDir) {
    const failureContext: FailureContext = { missing: result.missing };
    const mutResult = await runMutationLoop({
      benchDir: opts.benchDir,
      vibehackDataDir: opts.vibehackDataDir,
      runMutator: opts.runMutator,
      runBench: async (innerOpts) => {
        return runBench({ ...opts, vibehackDataDir: innerOpts.vibehackDataDir, mutate: false });
      },
      regressionBenches: opts.regressionBenches ?? [],
      failureContext,
    });

    const mutReportPath = path.join(
      resultsDir,
      `${new Date().toISOString().replace(/[:.]/g, "-")}-${mutResult.landed ? "mutated" : "rejected"}.md`,
    );
    fs.writeFileSync(mutReportPath, renderMutationReport(mutResult), "utf8");
  }

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
