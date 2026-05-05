// vibehack_tool_search (v1.3, CyberStrike "tool-search" inspired).
//
// CyberStrike ships a lazy-registry pattern: instead of listing 30+ tools to
// the model up front (eating context), it exposes one tool that searches the
// catalogue by capability/domain and returns the top matches. We implement the
// same here over our hand-curated tool-catalog.ts. PATH-presence is folded in
// from lib/tool-detector.ts so the Planner sees what's actually runnable on
// the operator's box (Kali, WSL, mac, Windows).

import { Type } from "@sinclair/typebox";
import { TOOL_CATALOG, type ToolEntry } from "../data/tool-catalog.ts";
import { detectAllTools } from "../lib/tool-detector.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";
import { lazyToolName, getLoadedSet } from "../lib/lazy-tools.ts";
import { activeEngagementId } from "../lib/engagement.ts";

const DOMAINS = ["web", "network", "cloud", "mobile", "recon", "vuln", "fuzz", "report"] as const;

export const toolSearchSchema = Type.Object({
  query: Type.Optional(Type.String()),
  domain: Type.Optional(Type.Union(DOMAINS.map((d) => Type.Literal(d)))),
  installed_only: Type.Optional(Type.Boolean()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 30 })),
}, { additionalProperties: false });

function score(entry: ToolEntry, query: string, domain?: string): number {
  let s = 0;
  const q = query.toLowerCase();
  if (q && entry.name.toLowerCase().includes(q)) s += 50;
  if (q && entry.description.toLowerCase().includes(q)) s += 30;
  for (const cap of entry.capabilities) {
    if (q && cap.toLowerCase().includes(q)) s += 20;
  }
  if (domain && entry.domain.includes(domain as any)) s += 25;
  return s;
}

export const toolSearchTool = {
  name: "vibehack_tool_search",
  label: "Search the bug-bounty tool catalogue",
  description:
    "Find security tools by capability/domain. Returns name, description, " +
    "example invocation, and whether the binary is on PATH. Catalogue covers " +
    "recon (subfinder/amass/httpx), fuzzing (ffuf/feroxbuster), vuln scanners " +
    "(nuclei/sqlmap/dalfox), cloud (prowler/scout/pacu), mobile (frida/jadx), " +
    "AD (nxc/impacket/bloodhound), generic (nmap/curl).",
  parameters: toolSearchSchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, { search: "query", q: "query", area: "domain", n: "limit", max: "limit" }),
  ) as any,

  async execute(_callId: string, params: any): Promise<any> {
    const installed = detectAllTools();
    const query = String(params.query ?? "").trim();
    const limit = params.limit ?? 8;
    // v1.4: report which lazy tools are currently loaded for the active eng.
    let loadedSet = new Set<string>();
    try {
      const eng = await activeEngagementId();
      if (eng) loadedSet = await getLoadedSet(eng);
    } catch {}

    let matches = TOOL_CATALOG;
    if (params.installed_only) matches = matches.filter((t) => installed[t.name]);
    if (params.domain) matches = matches.filter((t) => t.domain.includes(params.domain));

    const ranked = matches
      .map((t) => ({ entry: t, score: score(t, query, params.domain) }))
      .filter((x) => query ? x.score > 0 : true)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => {
        const id = lazyToolName(entry);
        return {
          id, // v1.4: feed this to vibehack_load_tools to expose the wrapper
          name: entry.name,
          domain: entry.domain,
          capabilities: entry.capabilities,
          description: entry.description,
          example: entry.example,
          installed: !!installed[entry.name],
          loaded: loadedSet.has(id),
          install_hint: installed[entry.name] ? undefined : entry.install,
        };
      });

    return {
      query,
      domain: params.domain ?? null,
      total_in_catalogue: TOOL_CATALOG.length,
      total_installed: Object.values(installed).filter(Boolean).length,
      total_loaded: loadedSet.size,
      matches: ranked,
      hint: ranked.length
        ? "Call vibehack_load_tools({tool_ids:['<id>']}) to make a tool callable in the next turn."
        : undefined,
    };
  },
};
