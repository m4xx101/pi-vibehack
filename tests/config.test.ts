import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { readConfig, writeConfig, defaultConfig, migrateConfig } from "../bin/lib/config.js";

const TMP = path.join(os.tmpdir(), `vibehack-config-${process.pid}`);

beforeEach(() => fs.mkdirSync(TMP, { recursive: true }));
afterEach(() => fs.rmSync(TMP, { recursive: true, force: true }));

describe("config.js", () => {
  it("defaultConfig('hybrid') returns hybrid profile defaults", () => {
    const cfg = defaultConfig("hybrid");
    expect(cfg.models.planner).toBe("claude-haiku-4-5");
    expect(cfg.models.operator).toBe("claude-opus-4-7");
    expect(cfg.models.reporter).toBe("claude-opus-4-7");
    expect(cfg.version).toBeTypeOf("number");
  });

  it("writeConfig + readConfig round-trips", () => {
    const cfgPath = path.join(TMP, "config.yaml");
    const cfg = defaultConfig("hybrid");
    cfg.models.planner = "gpt-5";
    writeConfig(cfgPath, cfg);
    const read = readConfig(cfgPath);
    expect(read.models.planner).toBe("gpt-5");
  });

  it("readConfig on missing file returns null (not throw)", () => {
    const cfgPath = path.join(TMP, "nonexistent.yaml");
    expect(readConfig(cfgPath)).toBeNull();
  });

  it("migrateConfig stamps version when missing", () => {
    const old = { models: { planner: "x", operator: "y", reporter: "z" } };
    const migrated = migrateConfig(old);
    expect(migrated.version).toBeGreaterThanOrEqual(1);
  });
});
