import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { asString } from "./coerce.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export function detectProvider(modelId: unknown): "claude" | "codex" | "gemini" | "local" {
  const m = asString(modelId).toLowerCase();
  if (m.includes("claude")) return "claude";
  if (m.includes("gpt") || m.includes("o3") || m.includes("o4") || m.includes("codex")) return "codex";
  if (m.includes("gemini")) return "gemini";
  return "local";
}

export async function loadPersona(provider: ReturnType<typeof detectProvider>): Promise<string> {
  // Resolve from package prompts/personas — assume extension is loaded from <pkg>/extensions/pi-vibehack/lib/persona.ts
  const path = join(HERE, "..", "..", "..", "prompts", "personas", `${provider.toUpperCase()}.md`);
  try { return await fs.readFile(path, "utf8"); }
  catch { return ""; }
}
