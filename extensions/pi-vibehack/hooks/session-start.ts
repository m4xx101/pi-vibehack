// session_start hook: rehydrates the DCP dead-node set from the event log so
// pruned/dead branches stay folded after a restart, then announces the active
// engagement to the operator.

import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { readEvents } from "../lib/events.ts";
import { foldNodes } from "../render/tree-md.ts";
import { markNodeDead } from "../dcp-rules/index.ts";
import { registerProvidersFromConfig } from "./register-providers.ts";

export function registerSessionStartHook(pi: any) {
  pi.on("session_start", async (_event: any, ctx: any) => {
    // Best-effort: register custom providers from ~/.pi/agent/vibehack/config.yaml.
    // Wrapped in try/catch so a bad config never blocks session_start.
    try {
      const os = await import("node:os");
      const path = await import("node:path");
      const { readConfig } = await import("../lib/config-runtime.ts");
      const cfgPath = path.join(os.homedir(), ".pi", "agent", "vibehack", "config.yaml");
      const cfg = readConfig(cfgPath);
      if (cfg) registerProvidersFromConfig(pi, cfg);
    } catch (e: any) {
      ctx?.ui?.notify?.(
        `pi-vibehack: provider registration skipped (${e?.message ?? String(e)})`,
        "warn",
      );
    }

    try {
      const eng = await activeEngagementId();
      if (!eng) {
        ctx?.ui?.notify?.(
          "pi-vibehack ready · no active engagement (run /vibehack <target>)",
          "info",
        );
        return;
      }
      const events = await readEvents(engagementDir(eng));
      const nodes = foldNodes(events);
      for (const n of nodes.values()) {
        if (n.status === "dead" || n.status === "pruned") {
          try { markNodeDead(n.node_id); } catch {}
        }
      }
      ctx?.ui?.notify?.(
        `pi-vibehack resumed engagement ${eng} (${nodes.size} nodes)`,
        "info",
      );

      // Soft-dep banners
      const hints: string[] = [];
      try {
        const { detectScurl } = await import("../lib/scurl-bridge.ts");
        if (!(await detectScurl())) hints.push("💡 install pi-super-curl: `npm i -g pi-super-curl`");
      } catch {}
      try {
        const { detectBrowserBackend } = await import("../lib/browser-bridge.ts");
        if ((await detectBrowserBackend()) === "none") hints.push("💡 install surf-cli or use playwright-cli: `npm i -g surf-cli`");
      } catch {}
      try {
        const { spawn } = await import("node:child_process");
        const SHELL_OPT = process.platform === "win32" ? { shell: true } : {};
        const ok = await new Promise<boolean>((resolve) => {
          const c = spawn("graphify", ["--version"], { stdio: "ignore", ...SHELL_OPT });
          c.on("error", () => resolve(false));
          c.on("close", (code) => resolve(code === 0));
        });
        if (!ok) hints.push("💡 install graphify for cross-engagement recall (falling back to grep)");
      } catch {}
      for (const h of hints) ctx?.ui?.notify?.(h, "info");
    } catch (e: any) {
      ctx?.ui?.notify?.(
        `pi-vibehack session_start failed: ${e?.message ?? String(e)}`,
        "warn",
      );
    }
  });
}
