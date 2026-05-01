import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Value } from "@sinclair/typebox/value";
import { OperatorOutputSchema, type OperatorOutput } from "./operator-output-schema.ts";
import { readProfile } from "../../../bin/lib/data-dir.js";
import { vibehackRoot } from "./engagement.ts";

export interface OperatorInput {
  engagement_id: string;
  node_id: string;
  phase: string;
  claim: string;
  next_test: string;
  falsifier: string;
  requires_browser?: boolean;
  recipe_hints?: string[];
  specialist_skill?: string | null;
  auth_profiles?: any[];
  scope_notes?: string;
  previous_handoff?: string;
}

export async function findPiBinary(): Promise<string> {
  return process.env.VIBEHACK_PI_BIN ?? "pi";
}

export async function spawnOperator(
  input: OperatorInput,
  systemPromptBody: string,
  timeoutMs = 600_000,
): Promise<OperatorOutput> {
  const profile = ((await readProfile(vibehackRoot())) as { operator?: string } | null) ?? {
    operator: "claude-opus-4-7",
  };
  const operatorModel = profile.operator ?? "claude-opus-4-7";

  const tmpSys = join(await fs.mkdtemp(join(tmpdir(), "vh-op-")), "system.md");
  await fs.writeFile(tmpSys, systemPromptBody, "utf8");

  const pi = await findPiBinary();
  const args = [
    "--mode",
    "json",
    "-p",
    "--no-session",
    "--append-system-prompt",
    tmpSys,
    "--model",
    operatorModel,
  ];

  const userPrompt = `Operator input contract:\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n\nExecute the next_test. Return EXACTLY the OperatorOutput JSON via terminate=true. Do not narrate outside JSON.`;

  return await new Promise<OperatorOutput>((resolve, reject) => {
    const child = spawn(pi, [...args, userPrompt], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("operator subprocess timeout"));
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
        return reject(new Error(`operator exit ${code}: ${stderr.slice(0, 500)}`));
      }
      const parsed = parseOperatorJson(stdout);
      if (!parsed) {
        return reject(
          new Error(`operator returned no parseable JSON. tail: ${stdout.slice(-500)}`),
        );
      }
      if (!Value.Check(OperatorOutputSchema, parsed)) {
        const errs = [...Value.Errors(OperatorOutputSchema, parsed)]
          .slice(0, 3)
          .map((e) => `${e.path}: ${e.message}`)
          .join("; ");
        return reject(new Error(`operator output failed schema: ${errs}`));
      }
      resolve(parsed as OperatorOutput);
    });
  });
}

export function parseOperatorJson(stdout: string): unknown | null {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj: any = JSON.parse(lines[i]);
      if (
        obj?.type === "tool_result" &&
        obj?.toolName === "structured_output" &&
        obj?.terminate === true &&
        obj?.output
      ) {
        return obj.output;
      }
      if (obj?.type === "final_message" && obj?.structured) return obj.structured;
    } catch {}
  }
  const match = stdout.match(/\{[\s\S]*\}\s*$/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}
