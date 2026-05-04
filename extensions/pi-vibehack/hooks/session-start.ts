// session_start hook: rehydrates the DCP dead-node set from the event log so
// pruned/dead branches stay folded after a restart, then announces the active
// engagement to the operator.

import { activeEngagementId, engagementDir } from "../lib/engagement.ts";
import { readEvents } from "../lib/events.ts";
import { foldNodes } from "../render/tree-md.ts";
import { markNodeDead } from "../dcp-rules/index.ts";
import { registerProvidersFromConfig } from "./register-providers.ts";
import { detectInstalledExtensions } from "../lib/extension-detector.ts";
import { activateIntegrations } from "../integrations/index.ts";
import { setDetected } from "../lib/detector-cache.ts";
import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from "../lib/typed-pi.ts";

export function registerSessionStartHook(pi: ExtensionAPI) {
  pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
    // Read vibehack config once; both provider registration and soft-dep prompt use it.
    let cfg: any = null;
    try {
      const os = await import("node:os");
      const path = await import("node:path");
      const { readConfig } = await import("../lib/config-runtime.ts");
      const cfgPath = path.join(os.homedir(), ".pi", "agent", "vibehack", "config.yaml");
      cfg = readConfig(cfgPath);
    } catch (e: any) {
      ctx?.ui?.notify?.(
        `pi-vibehack: config load skipped (${e?.message ?? String(e)})`,
        "warning",
      );
    }

    // Best-effort: register custom providers from ~/.pi/agent/vibehack/config.yaml.
    // Wrapped in try/catch so a bad config never blocks session_start.
    try {
      if (cfg) registerProvidersFromConfig(pi, cfg);
    } catch (e: any) {
      ctx?.ui?.notify?.(
        `pi-vibehack: provider registration skipped (${e?.message ?? String(e)})`,
        "warning",
      );
    }

    // Best-effort: detect Kali tool capabilities (cache hit reuses, miss probes
    // PATH and writes ~/.pi/agent/vibehack/.capabilities.json). Soft-companion
    // Kali-MCP banner if mcp-kali-server / zebbern-kali-mcp is on PATH. Wrapped
    // so a detection failure never blocks session_start.
    try {
      const os = await import("node:os");
      const path = await import("node:path");
      const {
        detectKaliCapabilities,
        loadCachedCapabilities,
        saveCachedCapabilities,
        detectKaliMcp,
      } = await import("../lib/kali-tools.ts");
      const capPath = path.join(os.homedir(), ".pi", "agent", "vibehack", ".capabilities.json");
      let caps = loadCachedCapabilities(capPath);
      if (!caps) {
        caps = detectKaliCapabilities();
        saveCachedCapabilities(capPath, caps);
      }
      const availableCount = Object.values(caps).filter((c: any) => c.available).length;
      if (availableCount > 5) {
        ctx?.ui?.notify?.(`💡 ${availableCount} Kali tools detected on PATH`, "info");
      }
      const mcp = detectKaliMcp();
      if (mcp) {
        ctx?.ui?.notify?.(
          `💡 Kali-MCP detected (${mcp}) — additional tools available via MCP`,
          "info",
        );
      }
    } catch (e: any) {
      ctx?.ui?.notify?.(
        `pi-vibehack: kali detection skipped (${e?.message ?? String(e)})`,
        "warning",
      );
    }

    // Best-effort: scan for installed pi-extensions + operator skills, activate
    // documented integrations, and stash the result for <recall> recipe_hints.
    try {
      const os = await import("node:os");
      const path = await import("node:path");
      const detected = detectInstalledExtensions({
        globalDir: path.join(os.homedir(), ".pi", "agent", "extensions"),
        localDir: path.join(process.cwd(), ".pi", "extensions"),
        skillsDir: path.join(os.homedir(), ".pi", "agent", "skills"),
      });
      setDetected(detected);
      try {
        activateIntegrations(pi, detected);
      } catch (e: any) {
        ctx?.ui?.notify?.(
          `pi-vibehack: integration activation partial (${e?.message ?? String(e)})`,
          "warning",
        );
      }
      const extCount = Object.keys(detected.extensions).length;
      const skillCount = detected.skills.length;
      if (extCount > 0 || skillCount > 0) {
        ctx?.ui?.notify?.(
          `💡 detected ${extCount} pi-extension${extCount !== 1 ? "s" : ""} + ${skillCount} operator skill${skillCount !== 1 ? "s" : ""} (auto-leverage active)`,
          "info",
        );
      }
    } catch (e: any) {
      ctx?.ui?.notify?.(
        `pi-vibehack: extension detection skipped (${e?.message ?? String(e)})`,
        "warning",
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

      // Soft-dep handling: batch auto-install when enabled, else legacy advisory banners.
      const autoInstallEnabled = cfg?.auto_install?.enabled === true;

      if (autoInstallEnabled) {
        try {
          const { detectMissingSoftDeps, promptInstall } = await import("../lib/soft-dep-installer.ts");
          const missing = detectMissingSoftDeps();
          if (missing.length > 0) {
            // pi exposes a boolean ctx.ui.confirm(question, detail) — no free-text askUser.
            // Adapt: confirm() === true ⇒ "y" (yes-all); false ⇒ "n" (decline-all, fallbacks).
            const confirmFn = typeof ctx?.ui?.confirm === "function" ? ctx.ui.confirm : null;
            if (confirmFn) {
              const list = missing.map(d => d.name).join(", ");
              const ask = async (_q: string) => {
                const yes = await confirmFn(
                  `Install missing soft deps via npm -g? (${list})`,
                  "Decline to use built-in fallback chains.",
                );
                return yes ? "y" : "n";
              };
              const result = await promptInstall(missing, { ask });
              if (result.installed.length > 0) ctx?.ui?.notify?.(`✓ installed: ${result.installed.join(", ")}`, "info");
              if (result.declined.length > 0) ctx?.ui?.notify?.(`💡 fallbacks active for: ${result.declined.join(", ")}`, "info");
            } else {
              ctx?.ui?.notify?.(
                `💡 missing soft deps: ${missing.map(d => d.name).join(", ")} (auto-install requires interactive session)`,
                "info",
              );
            }
          }
        } catch (e: any) {
          ctx?.ui?.notify?.(`pi-vibehack: soft-dep prompt failed: ${e?.message ?? String(e)}`, "warning");
        }
      } else {
        // Legacy advisory banners (auto_install disabled or unset).
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
      }
    } catch (e: any) {
      ctx?.ui?.notify?.(
        `pi-vibehack session_start failed: ${e?.message ?? String(e)}`,
        "warning",
      );
    }
  });
}
