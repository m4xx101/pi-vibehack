import { describe, it, expect, vi } from "vitest";
import { runBench } from "../extensions/pi-vibehack/lib/evolve.ts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function makeBench(tmp: string, opts: { up?: string; down?: string; expected: string }) {
  fs.writeFileSync(path.join(tmp, "up.sh"), opts.up ?? "#!/bin/sh\necho ready\nexit 0\n");
  fs.writeFileSync(path.join(tmp, "down.sh"), opts.down ?? "#!/bin/sh\nexit 0\n");
  fs.writeFileSync(path.join(tmp, "expected-findings.yaml"), opts.expected);
  fs.chmodSync(path.join(tmp, "up.sh"), 0o755);
  fs.chmodSync(path.join(tmp, "down.sh"), 0o755);
}

describe("runBench (no --mutate)", () => {
  it("up→engagement→evaluate→down lifecycle, returns pass on matched findings", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-evolve-"));
    try {
      makeBench(tmp, {
        expected: "expected_findings:\n  - kind: SQLi\nfail_on_missing: [SQLi]\nallow_extras: true\n",
      });
      const fakeEngagement = vi.fn(async () => [{ kind: "SQLi" }]);
      const result = await runBench({ benchDir: tmp, runEngagement: fakeEngagement, mutate: false });
      expect(result.passed).toBe(true);
      expect(fakeEngagement).toHaveBeenCalled();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("returns fail when fail_on_missing kind is absent", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-evolve-"));
    try {
      makeBench(tmp, {
        expected: "expected_findings:\n  - kind: SQLi\nfail_on_missing: [SQLi]\nallow_extras: true\n",
      });
      const fakeEngagement = vi.fn(async () => []);
      const result = await runBench({ benchDir: tmp, runEngagement: fakeEngagement, mutate: false });
      expect(result.passed).toBe(false);
      expect(result.missing).toContain("SQLi");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("writes results/<timestamp>.md report", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-evolve-"));
    try {
      makeBench(tmp, {
        expected: "expected_findings:\n  - kind: SQLi\nfail_on_missing: [SQLi]\nallow_extras: true\n",
      });
      await runBench({ benchDir: tmp, runEngagement: async () => [{ kind: "SQLi" }], mutate: false });
      const resultsDir = path.join(tmp, "results");
      expect(fs.existsSync(resultsDir)).toBe(true);
      const files = fs.readdirSync(resultsDir).filter(f => f.endsWith(".md"));
      expect(files.length).toBeGreaterThan(0);
      const content = fs.readFileSync(path.join(resultsDir, files[0]), "utf8");
      expect(content).toContain("passed: true");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("calls down.sh even when up.sh fails", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-evolve-"));
    try {
      makeBench(tmp, {
        up: "#!/bin/sh\nexit 1\n",  // up fails
        down: "#!/bin/sh\necho 'down called'\nexit 0\n",
        expected: "expected_findings:\n  - kind: SQLi\nfail_on_missing: [SQLi]\nallow_extras: true\n",
      });
      const fakeEngagement = vi.fn();
      await expect(runBench({ benchDir: tmp, runEngagement: fakeEngagement, mutate: false })).rejects.toThrow();
      // Engagement should NOT have run (up failed)
      expect(fakeEngagement).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("missing expected-findings.yaml throws clear error", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-evolve-"));
    try {
      // No expected-findings.yaml
      await expect(runBench({ benchDir: tmp, runEngagement: async () => [], mutate: false })).rejects.toThrow(/expected-findings\.yaml/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("missing expected_findings array throws clear error", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-evolve-"));
    try {
      fs.writeFileSync(path.join(tmp, "up.sh"), "#!/bin/sh\nexit 0\n");
      fs.writeFileSync(path.join(tmp, "down.sh"), "#!/bin/sh\nexit 0\n");
      fs.writeFileSync(path.join(tmp, "expected-findings.yaml"), "target: http://example\n");  // no expected_findings
      fs.chmodSync(path.join(tmp, "up.sh"), 0o755);
      fs.chmodSync(path.join(tmp, "down.sh"), 0o755);
      await expect(runBench({ benchDir: tmp, runEngagement: async () => [], mutate: false })).rejects.toThrow(/expected_findings/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("malformed yaml throws clear error", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-evolve-"));
    try {
      fs.writeFileSync(path.join(tmp, "up.sh"), "#!/bin/sh\nexit 0\n");
      fs.writeFileSync(path.join(tmp, "down.sh"), "#!/bin/sh\nexit 0\n");
      fs.writeFileSync(path.join(tmp, "expected-findings.yaml"), "[ unclosed");
      fs.chmodSync(path.join(tmp, "up.sh"), 0o755);
      fs.chmodSync(path.join(tmp, "down.sh"), 0o755);
      await expect(runBench({ benchDir: tmp, runEngagement: async () => [], mutate: false })).rejects.toThrow();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
