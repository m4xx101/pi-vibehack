import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Save and restore EVERY .md file in prompts/ (top-level only — not personas/)
// because rewritePromptsForProfile may modify any of them. Saving only a
// handful means a crash mid-test (or a bug in the implementation that touches
// unexpected files) leaks `model: test-*` values into the working tree.

describe("rewritePromptsForProfile", () => {
  let saved: { path: string; body: string }[] = [];
  const HERE = dirname(fileURLToPath(import.meta.url));
  const PROMPTS = join(HERE, "..", "prompts");

  beforeEach(async () => {
    saved = [];
    const entries = await fs.readdir(PROMPTS, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const p = join(PROMPTS, entry.name);
      saved.push({ path: p, body: await fs.readFile(p, "utf8") });
    }
  });

  afterEach(async () => {
    // Always restore — even if the test threw mid-execution.
    for (const s of saved) {
      try { await fs.writeFile(s.path, s.body, "utf8"); } catch {}
    }
  });

  it("rewrites planner / operator / reporter model lines", async () => {
    const { rewritePromptsForProfile } = await import("../bin/lib/rewrite-prompts.js");
    await rewritePromptsForProfile({ planner: "test-planner", operator: "test-operator", reporter: "test-reporter" });
    expect(await fs.readFile(join(PROMPTS, "vibehack.md"), "utf8")).toMatch(/^model: test-planner/m);
    expect(await fs.readFile(join(PROMPTS, "confirm.md"), "utf8")).toMatch(/^model: test-operator/m);
    expect(await fs.readFile(join(PROMPTS, "vibehack-complete.md"), "utf8")).toMatch(/^model: test-reporter/m);
  });

  it("does not modify prompts outside the role lists (e.g., extension-handled commands like vibehack-tree)", async () => {
    const { rewritePromptsForProfile } = await import("../bin/lib/rewrite-prompts.js");
    const beforeTree = await fs.readFile(join(PROMPTS, "vibehack-tree.md"), "utf8");
    await rewritePromptsForProfile({ planner: "test-planner", operator: "test-operator", reporter: "test-reporter" });
    const afterTree = await fs.readFile(join(PROMPTS, "vibehack-tree.md"), "utf8");
    expect(afterTree).toBe(beforeTree);
  });

  it("rewritePromptsForProfile reads model assignments from config.yaml when present", async () => {
    const os = await import("node:os");
    const TMP = join(os.tmpdir(), `vh-rewrite-cfg-${process.pid}`);
    await fs.mkdir(TMP, { recursive: true });
    try {
      const cfgPath = join(TMP, "config.yaml");
      const { writeConfig, defaultConfig } = await import("../bin/lib/config.js");
      const cfg = defaultConfig("hybrid");
      cfg.models.planner = "custom-planner-model";
      writeConfig(cfgPath, cfg);

      const { rewritePromptsForProfile } = await import("../bin/lib/rewrite-prompts.js");
      await rewritePromptsForProfile("hybrid", { configPath: cfgPath, promptsDir: PROMPTS });

      const planner = await fs.readFile(join(PROMPTS, "vibehack.md"), "utf8");
      expect(planner).toMatch(/model:\s*custom-planner-model/);
    } finally {
      await fs.rm(TMP, { recursive: true, force: true });
    }
  });
});
