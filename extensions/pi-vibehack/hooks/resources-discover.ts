// resources_discover hook — feeds pi-mono the bundled vibehack skills and
// prompt directories so they're discoverable via pi's native loader. This
// replaces the v1.1.x approach of stuffing them into the system prompt by
// hand. See `pi-mono dist/core/extensions/types.d.ts:376` —
// `resources_discover` returns `{skillPaths, promptPaths, themePaths}`.
//
// Phase 2 of the v1.2 rewire plan.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "../lib/typed-pi.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
// hooks/ -> extensions/pi-vibehack/ -> extensions/ -> repo root
const PKG_ROOT = resolve(HERE, "..", "..", "..");

export function computeResourcePaths(): { skillPaths: string[]; promptPaths: string[] } {
  return {
    skillPaths: [join(PKG_ROOT, "skills")],
    promptPaths: [join(PKG_ROOT, "prompts")],
  };
}

export function registerResourcesDiscoverHook(pi: ExtensionAPI) {
  pi.on("resources_discover", async () => {
    return computeResourcePaths();
  });
}
