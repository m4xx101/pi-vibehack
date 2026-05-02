import { describe, it, expect, vi } from "vitest";
import { runMutationLoop, type MutationProposal } from "../extensions/pi-vibehack/lib/evolve.ts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

function makeFakeDataDir(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutdata-"));
  try {
    execSync("git init -q", { cwd: tmp, stdio: "pipe" });
    fs.writeFileSync(path.join(tmp, "README.md"), "# vibehack data dir\n");
    execSync("git add . && git -c user.email=t@t -c user.name=t commit -q -m init", { cwd: tmp, stdio: "pipe" });
  } catch {}
  return tmp;
}

describe("runMutationLoop", () => {
  it("invokes mutator subagent + re-runs bench in worktree; lands on regression-pass", async () => {
    const dataDir = makeFakeDataDir();
    const benchDir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutbench-"));
    try {
      const fakeMutator = vi.fn(async () => ({
        mutation_target: "skills/learned/sqli-login/SKILL.md",
        before: "",
        after: "---\nname: sqli-login\nauto_generated: true\n---\nNew recipe content.\n",
        rationale: "missing recipe for /login SQLi",
      } as MutationProposal));
      const fakeRunBench = vi.fn(async () => ({ passed: true, matched: [], missing: [], extras: [] }));

      const result = await runMutationLoop({
        benchDir,
        vibehackDataDir: dataDir,
        runMutator: fakeMutator,
        runBench: fakeRunBench,
        regressionBenches: [],
        failureContext: { missing: ["SQLi"] },
      });

      expect(fakeMutator).toHaveBeenCalledOnce();
      expect(fakeRunBench).toHaveBeenCalled();
      expect(result.landed).toBe(true);
      expect(result.proposal?.mutation_target).toBe("skills/learned/sqli-login/SKILL.md");
      expect(fs.existsSync(path.join(dataDir, "skills/learned/sqli-login/SKILL.md"))).toBe(true);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(benchDir, { recursive: true, force: true });
    }
  });

  it("rejects mutation when target bench still fails post-mutation", async () => {
    const dataDir = makeFakeDataDir();
    const benchDir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutbench-"));
    try {
      const fakeMutator = vi.fn(async () => ({
        mutation_target: "skills/learned/x/SKILL.md",
        before: "", after: "---\nauto_generated: true\n---\nx", rationale: "y",
      } as MutationProposal));
      const fakeRunBench = vi.fn(async () => ({ passed: false, matched: [], missing: ["X"], extras: [] }));

      const result = await runMutationLoop({
        benchDir,
        vibehackDataDir: dataDir,
        runMutator: fakeMutator,
        runBench: fakeRunBench,
        regressionBenches: [],
        failureContext: { missing: ["X"] },
      });

      expect(result.landed).toBe(false);
      expect(result.reason).toMatch(/target bench/);
      expect(fs.existsSync(path.join(dataDir, "skills/learned/x/SKILL.md"))).toBe(false);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(benchDir, { recursive: true, force: true });
    }
  });

  it("rejects mutation when regression benches fail", async () => {
    const dataDir = makeFakeDataDir();
    const benchDir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutbench-"));
    const regBench = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutreg-"));
    try {
      const fakeMutator = vi.fn(async () => ({
        mutation_target: "skills/learned/y/SKILL.md",
        before: "", after: "---\nauto_generated: true\n---\ny", rationale: "z",
      } as MutationProposal));

      const fakeRunBench = vi.fn(async (opts: { benchDir: string }) =>
        opts.benchDir === regBench
          ? { passed: false, matched: [], missing: ["REG_FAIL"], extras: [] }
          : { passed: true, matched: [], missing: [], extras: [] }
      );

      const result = await runMutationLoop({
        benchDir,
        vibehackDataDir: dataDir,
        runMutator: fakeMutator,
        runBench: fakeRunBench,
        regressionBenches: [regBench],
        failureContext: { missing: ["X"] },
      });

      expect(result.landed).toBe(false);
      expect(result.reason).toMatch(/regression/);
      expect(fs.existsSync(path.join(dataDir, "skills/learned/y/SKILL.md"))).toBe(false);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(benchDir, { recursive: true, force: true });
      fs.rmSync(regBench, { recursive: true, force: true });
    }
  });

  it("rejects null mutation_target (mutator declined)", async () => {
    const dataDir = makeFakeDataDir();
    const benchDir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutbench-"));
    try {
      const fakeMutator = vi.fn(async () => ({
        mutation_target: null,
        before: "", after: "",
        rationale: "no clean fix",
      } as any));
      const fakeRunBench = vi.fn();

      const result = await runMutationLoop({
        benchDir,
        vibehackDataDir: dataDir,
        runMutator: fakeMutator,
        runBench: fakeRunBench,
        regressionBenches: [],
        failureContext: { missing: ["X"] },
      });

      expect(result.landed).toBe(false);
      expect(result.reason).toMatch(/declined|no.*mutation/);
      expect(fakeRunBench).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(benchDir, { recursive: true, force: true });
    }
  });

  it("rejects mutation_target outside skills/learned/ or specialists/learned/", async () => {
    const dataDir = makeFakeDataDir();
    const benchDir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutbench-"));
    try {
      const fakeMutator = vi.fn(async () => ({
        mutation_target: "skills/recipes/SHIPPED/SKILL.md",
        before: "", after: "x", rationale: "y",
      } as MutationProposal));
      const fakeRunBench = vi.fn();

      const result = await runMutationLoop({
        benchDir,
        vibehackDataDir: dataDir,
        runMutator: fakeMutator,
        runBench: fakeRunBench,
        regressionBenches: [],
        failureContext: { missing: ["X"] },
      });

      expect(result.landed).toBe(false);
      expect(result.reason).toMatch(/learned|invalid/);
      expect(fakeRunBench).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(benchDir, { recursive: true, force: true });
    }
  });

  it("rejects malformed proposal (e.g., after: object instead of string)", async () => {
    const dataDir = makeFakeDataDir();
    const benchDir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutbench-"));
    try {
      const fakeMutator = vi.fn(async () => ({
        mutation_target: "skills/learned/x/SKILL.md",
        before: "",
        after: { script: "rm -rf /" },  // wrong type!
        rationale: "y",
      } as any));
      const fakeRunBench = vi.fn();
      const result = await runMutationLoop({
        benchDir, vibehackDataDir: dataDir, runMutator: fakeMutator, runBench: fakeRunBench,
        regressionBenches: [], failureContext: { missing: ["X"] },
      });
      expect(result.landed).toBe(false);
      expect(result.reason).toMatch(/malformed/);
      expect(fakeRunBench).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(benchDir, { recursive: true, force: true });
    }
  });

  it("preserves prior version of canonical file when overwriting", async () => {
    const dataDir = makeFakeDataDir();
    const benchDir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutbench-"));
    try {
      // Pre-populate canonical path with prior content
      const targetSubpath = "skills/learned/preserve-test/SKILL.md";
      const canonical = path.join(dataDir, targetSubpath);
      fs.mkdirSync(path.dirname(canonical), { recursive: true });
      fs.writeFileSync(canonical, "---\nauto_generated: true\n---\nPRIOR CONTENT.\n");

      const fakeMutator = vi.fn(async () => ({
        mutation_target: targetSubpath,
        before: "PRIOR CONTENT.",
        after: "---\nauto_generated: true\n---\nNEW CONTENT.\n",
        rationale: "improvement",
      } as MutationProposal));
      const fakeRunBench = vi.fn(async () => ({ passed: true, matched: [], missing: [], extras: [] }));

      const result = await runMutationLoop({
        benchDir, vibehackDataDir: dataDir, runMutator: fakeMutator, runBench: fakeRunBench,
        regressionBenches: [], failureContext: { missing: ["X"] },
      });
      expect(result.landed).toBe(true);
      // Canonical now has new content
      expect(fs.readFileSync(canonical, "utf8")).toContain("NEW CONTENT.");
      // Prior was archived under bench results
      const archives = (fs.readdirSync(path.join(benchDir, "results")) || []).filter(f => f.endsWith("-prior.md"));
      expect(archives.length).toBeGreaterThan(0);
      const archiveContent = fs.readFileSync(path.join(benchDir, "results", archives[0]), "utf8");
      expect(archiveContent).toContain("PRIOR CONTENT.");
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(benchDir, { recursive: true, force: true });
    }
  });

  it("cleans up worktree on success AND on rejection", async () => {
    const dataDir = makeFakeDataDir();
    const benchDir = fs.mkdtempSync(path.join(os.tmpdir(), "vh-mutbench-"));
    try {
      const fakeMutator = vi.fn(async () => ({
        mutation_target: "skills/learned/cleanup-test/SKILL.md",
        before: "", after: "---\nauto_generated: true\n---\nx", rationale: "y",
      } as MutationProposal));
      const fakeRunBench = vi.fn(async () => ({ passed: false, matched: [], missing: ["X"], extras: [] }));

      await runMutationLoop({
        benchDir,
        vibehackDataDir: dataDir,
        runMutator: fakeMutator,
        runBench: fakeRunBench,
        regressionBenches: [],
        failureContext: { missing: ["X"] },
      });

      const parent = path.dirname(dataDir);
      const dataBasename = path.basename(dataDir);
      const siblings = fs.readdirSync(parent).filter(n => n.startsWith(dataBasename + ".mutation-"));
      expect(siblings).toEqual([]);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
      fs.rmSync(benchDir, { recursive: true, force: true });
    }
  });
});
