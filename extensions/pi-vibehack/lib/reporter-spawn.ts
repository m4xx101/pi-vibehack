import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readProfile } from "../../../bin/lib/data-dir.js";
import { vibehackRoot } from "./engagement.ts";

export type ReporterMode = "per-leaf" | "final";

export interface ReporterInput {
  engagement_id: string;
  mode: ReporterMode;
  node_id?: string;
  engagement_dir: string;
}

export async function spawnReporter(
  input: ReporterInput,
  systemPromptBody: string,
  timeoutMs = 900_000,
): Promise<{ report_path: string; finding_count: number; total_cost_usd: number }> {
  const profile = ((await readProfile(vibehackRoot())) as { reporter?: string } | null) ?? {
    reporter: "claude-opus-4-7",
  };
  const reporterModel = profile.reporter ?? "claude-opus-4-7";

  const tmpSys = join(await fs.mkdtemp(join(tmpdir(), "vh-rep-")), "system.md");
  await fs.writeFile(tmpSys, systemPromptBody, "utf8");

  const pi = process.env.VIBEHACK_PI_BIN ?? "pi";
  const args = [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--append-system-prompt",
    tmpSys,
    "--model",
    reporterModel,
    "--cwd",
    input.engagement_dir,
  ];

  const userPrompt =
    input.mode === "per-leaf"
      ? `Per-leaf reporter for node ${input.node_id} in engagement ${input.engagement_id}. Read events.jsonl, find the leaf, write a polished poc/${input.node_id}/poc.md with replay artifacts. Return JSON: {"report_path":"...","finding_count":1,"total_cost_usd":0.0}.`
      : `Final reporter for engagement ${input.engagement_id}. Read events.jsonl, tree.md, all poc/<node_id>/poc.md, AGENTS.md. Write report.md with: executive summary, findings table, full PoCs, reproduction steps, remediation, IoCs. Return JSON: {"report_path":"report.md","finding_count":N,"total_cost_usd":X}.`;

  return await new Promise((resolve, reject) => {
    const child = spawn(pi, [...args, userPrompt], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("reporter subprocess timeout"));
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      try {
        await fs.rm(tmpSys, { force: true });
      } catch {}
      if (code !== 0 && code !== null) {
        return reject(new Error(`reporter exit ${code}: ${stderr.slice(0, 500)}`));
      }
      const match = stdout.match(/\{[^{}]*"report_path"[\s\S]*?\}/g);
      if (!match) return reject(new Error("reporter returned no parseable JSON"));
      try {
        resolve(JSON.parse(match[match.length - 1]));
      } catch (e: any) {
        reject(new Error(`reporter JSON parse failed: ${e.message}`));
      }
    });
  });
}
