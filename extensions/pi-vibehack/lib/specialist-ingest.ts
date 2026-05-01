import { promises as fs } from "node:fs";
import { join } from "node:path";
import { vibehackRoot, slugify } from "./engagement.ts";

export interface SpecialistIngestRequest {
  kind: string;                  // e.g., "phishing", "k8s-recon"
  description: string;           // one-line purpose
  body: string;                  // full SKILL.md body (post-frontmatter)
}

export async function landSpecialist(req: SpecialistIngestRequest): Promise<{ ok: boolean; path: string; error?: string }> {
  const slug = slugify(req.kind);
  const dir = join(vibehackRoot(), "specialists", "learned", slug);
  await fs.mkdir(dir, { recursive: true });
  const skill = `---\nname: ${slug}-specialist\ndescription: ${req.description}\n---\n\n${req.body}\n`;
  if (!/^---\nname:\s+\S+\ndescription:\s+\S+/m.test(skill)) {
    return { ok: false, path: dir, error: "frontmatter validation failed" };
  }
  const skillPath = join(dir, "SKILL.md");
  await fs.writeFile(skillPath, skill, "utf8");
  return { ok: true, path: dir };
}
