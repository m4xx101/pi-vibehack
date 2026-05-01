import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("rewritePromptsForProfile", () => {
  let saved: { path: string; body: string }[] = [];
  const HERE = dirname(fileURLToPath(import.meta.url));
  const PROMPTS = join(HERE, "..", "prompts");

  beforeEach(async () => {
    saved = [];
    for (const f of ["vibehack.md", "confirm.md", "vibehack-complete.md"]) {
      const p = join(PROMPTS, f);
      saved.push({ path: p, body: await fs.readFile(p, "utf8") });
    }
  });
  afterEach(async () => {
    for (const s of saved) await fs.writeFile(s.path, s.body, "utf8");
  });

  it("rewrites planner / operator / reporter model lines", async () => {
    const { rewritePromptsForProfile } = await import("../bin/lib/rewrite-prompts.js");
    await rewritePromptsForProfile({ planner: "test-planner", operator: "test-operator", reporter: "test-reporter" });
    expect(await fs.readFile(join(PROMPTS, "vibehack.md"), "utf8")).toMatch(/^model: test-planner/m);
    expect(await fs.readFile(join(PROMPTS, "confirm.md"), "utf8")).toMatch(/^model: test-operator/m);
    expect(await fs.readFile(join(PROMPTS, "vibehack-complete.md"), "utf8")).toMatch(/^model: test-reporter/m);
  });
});
