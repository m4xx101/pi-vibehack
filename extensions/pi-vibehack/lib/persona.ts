import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Extract a model identifier string from arbitrary inputs. pi-mono passes either a
// string id directly OR a model object (e.g. { id: "claude-haiku-4-5", ... } or
// { name, provider, ... }). Coerce defensively so we never call toLowerCase on a
// non-string and crash the before_agent_start hook.
function modelIdString(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (typeof obj.id === "string") return obj.id;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.model === "string") return obj.model;
  }
  return "";
}

export function detectProvider(modelId: unknown): "claude" | "codex" | "gemini" | "local" {
  const m = modelIdString(modelId).toLowerCase();
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
