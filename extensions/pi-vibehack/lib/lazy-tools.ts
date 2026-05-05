// v1.4 — lazy tool registry (faithful to CyberStrike's pattern this time).
//
// CS's `tool_search` returns IDs; `load_tools` adds them to the LLM's tool
// list so they're callable in the next turn. Tools that aren't loaded eat
// zero context. We mirror this with pi-mono primitives:
//
//   1. Eagerly REGISTER one wrapper tool per catalogue entry at extension
//      load — `vibehack_run_<bin>`. Registration is cheap; it doesn't put
//      the tool in front of the model.
//   2. Track a per-engagement "loaded set" of tool IDs in `.loaded-tools`.
//   3. before-agent-start calls pi.setActiveTools([...base, ...loaded]) so
//      only loaded tools are actually exposed to the model.
//   4. `vibehack_load_tools` updates the loaded set.
//   5. `vibehack_tool_search` reports each match's `loaded` state.
//
// This is the genuine CS pattern (lazy registration ≠ static catalogue).

import { Type } from "@sinclair/typebox";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { TOOL_CATALOG, type ToolEntry } from "../data/tool-catalog.ts";
import { activeEngagementId, engagementDir } from "./engagement.ts";
import { detectBinary } from "./tool-detector.ts";

const LOADED_FILE = ".loaded-tools";

export function lazyToolName(entry: ToolEntry): string {
  // Sanitize bin name to a tool-name-friendly slug.
  return `vibehack_run_${entry.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}

export async function getLoadedSet(eng: string): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(join(engagementDir(eng), LOADED_FILE), "utf8");
    return new Set(raw.split("\n").map((l) => l.trim()).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function setLoadedSet(eng: string, ids: Set<string>): Promise<void> {
  const dir = engagementDir(eng);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, LOADED_FILE), [...ids].join("\n") + "\n", "utf8");
}

// Build one wrapper Tool def per catalogue entry. Each wraps pi.exec(bin,args).
// We accept a single `args: string[]` field plus optional cwd/timeout. The
// model is responsible for passing the right args; the catalogue entry's
// `example` field is part of the tool description so it has guidance.
export function buildLazyTools(piRef: { exec?: (cmd: string, args: string[], opts?: any) => Promise<any> }): any[] {
  return TOOL_CATALOG.map((entry) => {
    const name = lazyToolName(entry);
    return {
      name,
      label: `Run ${entry.name}`,
      description: [
        `Wraps the ${entry.name} binary (${entry.description}).`,
        `Domains: ${entry.domain.join(", ")}`,
        `Capabilities: ${entry.capabilities.join("; ")}`,
        `Example: ${entry.example}`,
        ``,
        `Pass arguments as a string array. Returns stdout/stderr/exit-code.`,
        `If the binary is not on PATH the tool returns {error:"not-installed"} with the install hint.`,
      ].join("\n"),
      parameters: Type.Object({
        args: Type.Array(Type.String()),
        cwd: Type.Optional(Type.String()),
        timeout_ms: Type.Optional(Type.Integer({ minimum: 1000, maximum: 600_000 })),
      }, { additionalProperties: false }),
      async execute(_callId: string, params: any): Promise<any> {
        if (!detectBinary(entry.bin)) {
          return {
            error: "not-installed",
            tool: entry.name,
            install_hint: entry.install ?? "(no install hint)",
          };
        }
        if (typeof piRef.exec !== "function") {
          return { error: "pi.exec unavailable in this runtime" };
        }
        try {
          const r = await piRef.exec(entry.bin, params.args ?? [], {
            cwd: params.cwd,
            timeout: params.timeout_ms ?? 60_000,
          });
          return {
            tool: entry.name,
            exit_code: r?.code ?? 0,
            killed: r?.killed ?? false,
            stdout: String(r?.stdout ?? "").slice(0, 32_000),
            stderr: String(r?.stderr ?? "").slice(0, 8_000),
          };
        } catch (e: any) {
          return { error: "exec-failed", reason: String(e?.message ?? e) };
        }
      },
    };
  });
}

export const LAZY_TOOL_NAMES = TOOL_CATALOG.map(lazyToolName);

// vibehack_load_tools — ergonomic load-into-context. Updates the per-engagement
// loaded set; before-agent-start picks it up at the next turn.
export const loadToolsTool = {
  name: "vibehack_load_tools",
  label: "Load lazy tools into context",
  description:
    "Activate one or more wrapper tools for the next turn. Use vibehack_tool_search " +
    "first to discover IDs. The id format is `vibehack_run_<binname>`. Already-loaded " +
    "tools are no-ops. Returns the resulting active set + token-budget hint.",
  parameters: Type.Object({
    tool_ids: Type.Array(Type.String(), { minItems: 1 }),
  }, { additionalProperties: false }),
  async execute(_callId: string, params: { tool_ids: string[] }): Promise<any> {
    const eng = await activeEngagementId();
    if (!eng) return { error: "no active engagement" };
    const loaded = await getLoadedSet(eng);
    const known = new Set(LAZY_TOOL_NAMES);
    const accepted: string[] = [];
    const rejected: string[] = [];
    for (const id of params.tool_ids) {
      if (!known.has(id)) { rejected.push(id); continue; }
      if (!loaded.has(id)) accepted.push(id);
      loaded.add(id);
    }
    await setLoadedSet(eng, loaded);
    return {
      loaded: [...loaded].sort(),
      newly_loaded: accepted,
      rejected,
      total_loaded: loaded.size,
      budget_hint: loaded.size >= 12
        ? "high tool count — consider unloading via vibehack_unload_tools"
        : "ok",
    };
  },
};

export const unloadToolsTool = {
  name: "vibehack_unload_tools",
  label: "Unload lazy tools from context",
  description: "Remove one or more wrapper tools from the active set.",
  parameters: Type.Object({
    tool_ids: Type.Array(Type.String(), { minItems: 1 }),
  }, { additionalProperties: false }),
  async execute(_callId: string, params: { tool_ids: string[] }): Promise<any> {
    const eng = await activeEngagementId();
    if (!eng) return { error: "no active engagement" };
    const loaded = await getLoadedSet(eng);
    for (const id of params.tool_ids) loaded.delete(id);
    await setLoadedSet(eng, loaded);
    return { loaded: [...loaded].sort(), total_loaded: loaded.size };
  },
};
