import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { vibehackRoot, engagementDir, activeEngagementId } from "../lib/engagement.ts";

export interface Subgraph {
  source: "engagement" | "global" | "fallback-grep";
  entities: { id: string; kind: string; label: string }[];
  edges: { from: string; to: string; type: string }[];
  notes: string[];
}

async function hasGraphify(): Promise<boolean> {
  return await new Promise((resolve) => {
    try {
      const c = spawn("graphify", ["--version"], { stdio: "ignore" });
      c.on("error", () => resolve(false));
      c.on("close", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}

async function graphifyQuery(graphDir: string, query: string): Promise<Subgraph | null> {
  return await new Promise((resolve) => {
    try {
      const c = spawn(
        "graphify",
        ["query", "--graph", graphDir, "--format", "json", query],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let stdout = "";
      c.stdout.on("data", (d) => { stdout += d.toString(); });
      c.on("close", (code) => {
        if (code !== 0) return resolve(null);
        try {
          const o = JSON.parse(stdout);
          const root = vibehackRoot();
          const isGlobal =
            graphDir === join(root, "graph") ||
            (graphDir.endsWith("graph") && graphDir.startsWith(root) && !graphDir.includes("engagements"));
          resolve({
            source: isGlobal ? "global" : "engagement",
            entities: o.entities ?? [],
            edges: o.edges ?? [],
            notes: o.notes ?? [],
          });
        } catch { resolve(null); }
      });
      c.on("error", () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

async function fallbackGrep(query: string): Promise<Subgraph> {
  const lines: string[] = [];
  const root = vibehackRoot();
  try {
    const engs = await fs.readdir(join(root, "engagements"));
    for (const e of engs) {
      const p = join(root, "engagements", e, "events.jsonl");
      try {
        const buf = await fs.readFile(p, "utf8");
        for (const l of buf.split("\n")) {
          if (l && l.toLowerCase().includes(query.toLowerCase())) {
            lines.push(`[${e}] ${l.slice(0, 240)}`);
          }
        }
      } catch {}
    }
  } catch {}
  return { source: "fallback-grep", entities: [], edges: [], notes: lines.slice(0, 20) };
}

export async function recall(query: string): Promise<Subgraph[]> {
  const out: Subgraph[] = [];
  const eng = await activeEngagementId();
  const graphifyAvailable = await hasGraphify();

  if (graphifyAvailable) {
    if (eng) {
      const local = await graphifyQuery(join(engagementDir(eng), "graph"), query);
      if (local) out.push(local);
    }
    const global = await graphifyQuery(join(vibehackRoot(), "graph"), query);
    if (global) out.push(global);
  }

  if (out.length === 0) out.push(await fallbackGrep(query));
  return out.slice(0, 3);
}

export async function triggerGraphifyUpdate(targetDir: string): Promise<void> {
  return await new Promise((resolve) => {
    try {
      const c = spawn("graphify", ["update", targetDir], { stdio: "ignore" });
      c.on("close", () => resolve());
      c.on("error", () => resolve());
    } catch {
      resolve();
    }
  });
}
