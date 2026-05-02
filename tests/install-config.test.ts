import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("install --planner/--operator/--reporter writes config.yaml", () => {
  it("writes config.yaml with explicit flags", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-install-"));
    try {
      const cfgPath = path.join(tmp, "config.yaml");
      execSync(
        `node bin/install.js --dry-run --config-out "${cfgPath}" --profile hybrid --planner gpt-5 --operator opus-4-7 --reporter local-llama-70b`,
        { stdio: "pipe" }
      );
      const { readConfig } = await import("../bin/lib/config.js");
      const cfg = readConfig(cfgPath);
      expect(cfg.models.planner).toBe("gpt-5");
      expect(cfg.models.operator).toBe("opus-4-7");
      expect(cfg.models.reporter).toBe("local-llama-70b");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
