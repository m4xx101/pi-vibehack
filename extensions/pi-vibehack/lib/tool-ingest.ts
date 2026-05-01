import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { vibehackRoot, slugify } from "./engagement.ts";
import { writePathShim, envWithShim } from "./path-shim.ts";

const SPAWN_OPTS = process.platform === "win32" ? { shell: true } : {};

export type IngestMode = "cli" | "repo" | "synthesis" | "inline";

export interface IngestRequest {
  mode: IngestMode;
  target: string;
  validate_against?: string;
  specialist_kind?: string | null;
  inline_spec?: string;
}

export interface IngestResult {
  ok: boolean;
  path: string;
  recipe_path?: string;
  validation: { kind: "help" | "against-target"; passed: boolean; output?: string };
  error?: string;
}

function which(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cmd = process.platform === "win32" ? "where" : "which";
    const c = spawn(cmd, [bin], { stdio: ["ignore", "pipe", "ignore"], ...SPAWN_OPTS });
    let out = "";
    c.stdout.on("data", (d) => {
      out += d.toString();
    });
    c.on("close", (code) => resolve(code === 0 ? out.trim().split(/\r?\n/)[0] : null));
    c.on("error", () => resolve(null));
  });
}

async function captureHelp(bin: string): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const c = spawn(bin, ["--help"], { stdio: ["ignore", "pipe", "pipe"], ...SPAWN_OPTS });
    let out = "";
    c.stdout.on("data", (d) => {
      out += d.toString();
    });
    c.stderr.on("data", (d) => {
      out += d.toString();
    });
    c.on("close", (code) => resolve({ ok: code === 0, out: out.slice(0, 4000) }));
    c.on("error", () => resolve({ ok: false, out: "" }));
  });
}

export async function ingestCli(req: IngestRequest): Promise<IngestResult> {
  const path = await which(req.target);
  if (!path) {
    return {
      ok: false,
      path: "",
      validation: { kind: "help", passed: false },
      error: `not on PATH: ${req.target}`,
    };
  }
  const help = await captureHelp(path);
  const slug = slugify(req.target);
  const dataRecipeDir = join(vibehackRoot(), "skills", "learned", slug);
  await fs.mkdir(dataRecipeDir, { recursive: true });
  const skill = `---\nname: ${slug}-recipes\ndescription: Recipes for ${req.target} (auto-ingested).\n---\n\n# ${req.target}\n\n## Help\n\n\`\`\`\n${help.out}\n\`\`\`\n\n## vibehack pattern\nRun: \`${req.target} <args>\` — save output to \`evidence/<node_id>-${slug}.txt\`.\n`;
  const recipePath = join(dataRecipeDir, "SKILL.md");
  await fs.writeFile(recipePath, skill, "utf8");
  return {
    ok: true,
    path,
    recipe_path: recipePath,
    validation: { kind: "help", passed: help.ok, output: help.out.slice(0, 200) },
  };
}

export async function ingestRepo(req: IngestRequest): Promise<IngestResult> {
  const slug = slugify(req.target.replace(/^https?:\/\//, "").replace(/\.git$/, ""));
  const dest = join(vibehackRoot(), "tools", slug);
  await fs.mkdir(dest, { recursive: true });
  await new Promise<void>((resolve) => {
    const c = spawn("git", ["clone", "--depth=1", req.target, dest], {
      stdio: "ignore",
      ...SPAWN_OPTS,
    });
    c.on("close", () => resolve());
    c.on("error", () => resolve());
  });
  await writePathShim();
  return { ok: true, path: dest, validation: { kind: "help", passed: true, output: "cloned" } };
}

export async function ingestSynthesis(req: IngestRequest): Promise<IngestResult> {
  const slug = slugify(req.target);
  const dest = join(vibehackRoot(), "tools", slug);
  try {
    await fs.access(dest);
  } catch {
    return {
      ok: false,
      path: dest,
      validation: { kind: "help", passed: false },
      error: "synthesis output dir missing — Operator subprocess must write to it",
    };
  }
  const bin = join(dest, "bin", slug);
  let validation: IngestResult["validation"];
  if (req.validate_against) {
    const env = await envWithShim();
    const r = await new Promise<{ ok: boolean; out: string }>((resolve) => {
      const c = spawn(bin, [req.validate_against!], {
        stdio: ["ignore", "pipe", "pipe"],
        env,
        ...SPAWN_OPTS,
      });
      let out = "";
      c.stdout.on("data", (d) => {
        out += d.toString();
      });
      c.stderr.on("data", (d) => {
        out += d.toString();
      });
      c.on("close", (code) => resolve({ ok: code === 0 && out.trim().length > 0, out }));
      c.on("error", () => resolve({ ok: false, out: "" }));
    });
    validation = { kind: "against-target", passed: r.ok, output: r.out.slice(0, 400) };
  } else {
    const h = await captureHelp(bin);
    validation = { kind: "help", passed: h.ok, output: h.out.slice(0, 200) };
  }
  if (!validation.passed) {
    await fs.rm(dest, { recursive: true, force: true });
    return { ok: false, path: dest, validation, error: "validation failed; rolled back" };
  }
  await writePathShim();
  return { ok: true, path: dest, validation };
}

export async function ingest(req: IngestRequest): Promise<IngestResult> {
  if (req.specialist_kind) {
    const { landSpecialist } = await import("./specialist-ingest.ts");
    const r = await landSpecialist({
      kind: req.specialist_kind,
      description: req.target.slice(0, 200),
      body: req.inline_spec ?? req.target,
    });
    return {
      ok: r.ok,
      path: r.path,
      recipe_path: r.path,
      validation: { kind: "help", passed: r.ok, output: r.ok ? "frontmatter ok" : (r.error ?? "") },
      error: r.error,
    };
  }
  if (req.mode === "cli") return ingestCli(req);
  if (req.mode === "repo") return ingestRepo(req);
  if (req.mode === "synthesis" || req.mode === "inline") return ingestSynthesis(req);
  return {
    ok: false,
    path: "",
    validation: { kind: "help", passed: false },
    error: `unknown mode: ${req.mode}`,
  };
}
