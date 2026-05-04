import { Type } from "@sinclair/typebox";
import { recall } from "../graph/recall.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

export const recallSchema = Type.Object({
  query: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

export const recallTool = {
  name: "vibehack_recall",
  label: "Recall (graphify)",
  description:
    "Query the cross-engagement knowledge graph (graphify) or fall back to grep over events.jsonl.",
  parameters: recallSchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, { q: "query" }),
  ) as any,

  async execute(_callId: string, params: any, _signal?: any, _onUpdate?: any, _ctx?: any) {
    const subs = await recall(params.query);
    const text = subs
      .map((s, i) => {
        const lines = [`[subgraph ${i + 1} from ${s.source}]`];
        for (const e of s.entities.slice(0, 8)) lines.push(`  - ${e.kind}: ${e.label} (${e.id})`);
        for (const ed of s.edges.slice(0, 8)) lines.push(`  - edge ${ed.type}: ${ed.from} -> ${ed.to}`);
        for (const n of s.notes.slice(0, 5)) lines.push(`  - note: ${n}`);
        return lines.join("\n");
      })
      .join("\n\n");

    return {
      content: [{ type: "text", text: text || "(no recall hits)" }],
      details: { subgraphs: subs.length },
    };
  },
};
