import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS = join(HERE, "..", "skills");

async function findSkillFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: string[] = [];
    try { entries = await fs.readdir(d); } catch { continue; }
    for (const e of entries) {
      const p = join(d, e);
      const st = await fs.stat(p).catch(() => null);
      if (!st) continue;
      if (st.isDirectory()) stack.push(p);
      else if (e === "SKILL.md") out.push(p);
    }
  }
  return out;
}

describe("bundled recipe + role-recipe + specialist SKILL.md files", () => {
  it("every SKILL.md has valid frontmatter (name + description)", async () => {
    const files = await findSkillFiles(SKILLS);
    expect(files.length).toBeGreaterThan(15);
    for (const f of files) {
      const body = await fs.readFile(f, "utf8");
      expect(body, `frontmatter missing in ${f}`).toMatch(/^---\n[\s\S]*?\n---\n/);
      expect(body, `name missing in ${f}`).toMatch(/^name:\s+\S+/m);
      expect(body, `description missing in ${f}`).toMatch(/^description:\s+\S+/m);
    }
  });

  it("recipe + specialist files include a vibehack pattern or discipline section", async () => {
    const files = await findSkillFiles(SKILLS);
    for (const f of files) {
      if (!/recipes|specialists/.test(f)) continue;
      const body = await fs.readFile(f, "utf8");
      expect(body, `${f} should reference vibehack pattern or discipline`).toMatch(/vibehack|discipline/i);
    }
  });
});
