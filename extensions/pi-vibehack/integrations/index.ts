import * as mcp from "./pi-mcp-adapter.ts";
import * as mem from "./memory-mode.ts";
import * as ho from "./handoff.ts";
import * as rw from "./pi-rewind-hook.ts";
import * as sc from "./pi-side-chat.ts";
import type { DetectorResult } from "../lib/extension-detector.ts";

const REGISTRY: Record<string, { activate: (pi: any) => void }> = {
  "pi-mcp-adapter": mcp,
  "memory-mode": mem,
  "handoff": ho,
  "pi-rewind-hook": rw,
  "pi-side-chat": sc,
};

export function activateIntegrations(pi: any, detected: DetectorResult): void {
  for (const name of Object.keys(detected.extensions)) {
    if (REGISTRY[name]) {
      try {
        REGISTRY[name].activate(pi);
      } catch (e) {
        console.warn(`[pi-vibehack] integration ${name} failed:`, (e as Error).message);
      }
    }
  }
}

export { REGISTRY as INTEGRATION_REGISTRY };
