import { promises as fs } from "node:fs";
import { join } from "node:path";
import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { renderEngagement } from "../render/render-engagement.ts";

export function registerTreeViewer(pi: any) {
  pi.registerCommand?.("vibehack-tree", {
    description: "Open the fullscreen hypothesis-tree viewer",
    handler: async (_args: string, ctx: any) => {
      const eng = await activeEngagementId();
      if (!eng) {
        ctx.ui.notify("no active engagement", "warn");
        return;
      }
      await renderEngagement(eng);
      const dir = engagementDir(eng);
      const treeMd = await fs.readFile(join(dir, "tree.md"), "utf8");
      const findingsMd = await fs.readFile(join(dir, "findings.md"), "utf8");
      const body = treeMd + "\n\n---\n\n" + findingsMd;
      if (typeof ctx.ui.custom === "function") {
        await ctx.ui.custom({
          title: `Engagement: ${eng}`,
          body,
          fullscreen: true,
          keys: { q: "close", Esc: "close" },
        });
      } else {
        ctx.ui.notify(body.slice(0, 4000), "info");
      }
    },
  });
}
