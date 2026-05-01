import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ingestCli, ingest } from "../extensions/pi-vibehack/lib/tool-ingest.ts";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), "vh-ingest-"));
  process.env.VIBEHACK_DATA_DIR = root;
});
afterEach(async () => {
  delete process.env.VIBEHACK_DATA_DIR;
  await fs.rm(root, { recursive: true, force: true });
});

describe("ingestCli", () => {
  it("creates a recipe SKILL.md for a CLI on PATH", async () => {
    const r = await ingestCli({ mode: "cli", target: "node" });
    expect(r.ok).toBe(true);
    expect(r.recipe_path).toBeDefined();
    const skill = await fs.readFile(r.recipe_path!, "utf8");
    expect(skill).toContain("---");
    expect(skill).toContain("node");
  });

  it("fails cleanly when CLI not on PATH", async () => {
    const r = await ingestCli({ mode: "cli", target: "definitely-not-a-real-binary-xyzzy-9999" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not on PATH/);
  });
});

describe("ingest --specialist", () => {
  it("lands a specialist SKILL.md in specialists/learned/", async () => {
    const r = await ingest({ mode: "inline", target: "Specialist for k8s recon", specialist_kind: "k8s-recon", inline_spec: "Body of the skill goes here." });
    expect(r.ok).toBe(true);
    expect(r.path).toMatch(/specialists[\\/]learned[\\/]k8s-recon/);
    const skill = await fs.readFile(join(r.path, "SKILL.md"), "utf8");
    expect(skill).toMatch(/^---\nname: k8s-recon-specialist/m);
    expect(skill).toMatch(/Body of the skill/);
  });
});
