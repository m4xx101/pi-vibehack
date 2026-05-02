import * as fs from "fs";
import * as path from "path";

export interface ExtensionInfo {
  name: string;
  version?: string;
  path: string;
}

export interface SkillInfo {
  name: string;
  description?: string;
  path: string;
}

export interface DetectorResult {
  extensions: Record<string, ExtensionInfo>;
  skills: SkillInfo[];
}

export interface DetectorOpts {
  globalDir?: string;
  localDir?: string;
  skillsDir?: string;
}

function parseFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

function scanExtensionDir(dir: string, target: Record<string, ExtensionInfo>): void {
  if (!fs.existsSync(dir)) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgPath = path.join(dir, entry.name, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      target[entry.name] = {
        name: entry.name,
        version: typeof pkg?.version === "string" ? pkg.version : undefined,
        path: path.join(dir, entry.name),
      };
    } catch { /* malformed package.json — skip */ }
  }
}

export function detectInstalledExtensions(opts: DetectorOpts = {}): DetectorResult {
  const result: DetectorResult = { extensions: {}, skills: [] };

  if (opts.globalDir) scanExtensionDir(opts.globalDir, result.extensions);
  if (opts.localDir)  scanExtensionDir(opts.localDir,  result.extensions);

  if (opts.skillsDir && fs.existsSync(opts.skillsDir)) {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(opts.skillsDir, { withFileTypes: true }); } catch { entries = []; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(opts.skillsDir, entry.name, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;
      try {
        const text = fs.readFileSync(skillPath, "utf8");
        const fm = parseFrontmatter(text);
        if (!fm.name) continue;
        result.skills.push({
          name: fm.name,
          description: fm.description,
          path: skillPath,
        });
      } catch { /* read error — skip */ }
    }
  }

  return result;
}
