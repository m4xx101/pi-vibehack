// Runtime config reader for the pi-vibehack extension.
//
// Owns the READ path for ~/.pi/agent/vibehack/config.yaml. The installer
// (bin/lib/config.js) owns the WRITE path. We keep these intentionally
// decoupled so the extension does not import across package boundaries.
//
// There is minor duplication of `defaultConfig` constants with bin/lib/config.js
// — that is acceptable: the extension and installer evolve together but should
// not be coupled at runtime via a shared module.

import * as fs from "node:fs";
import { createRequire } from "node:module";

export const CURRENT_VERSION = 1;

const HYBRID = { planner: "claude-haiku-4-5", operator: "claude-opus-4-7", reporter: "claude-opus-4-7" };

function defaultConfig(): any {
  return {
    version: CURRENT_VERSION,
    models: {
      planner: HYBRID.planner,
      operator: HYBRID.operator,
      reporter: HYBRID.reporter,
      fallbacks: { planner: [], operator: [], reporter: [] },
      per_prompt: {},
    },
    providers: {},
    auto_install: { enabled: true, allow_npm: true, fallback_on_decline: true },
    ui: {
      banner: { show_last_turn_cost: true, show_engagement_cost: true, cost_warn_threshold_usd: 0.5 },
    },
  };
}

const _require = createRequire(import.meta.url);
function loadYamlSync(): any {
  try {
    return _require("yaml");
  } catch {
    return null;
  }
}

export function migrateConfig(obj: any): any {
  if (!obj || typeof obj !== "object") return defaultConfig();
  const def = defaultConfig();
  if (!obj.version) obj.version = CURRENT_VERSION;

  if (!obj.models) {
    obj.models = def.models;
  } else {
    obj.models = { ...def.models, ...obj.models };
    obj.models.fallbacks = { ...def.models.fallbacks, ...(obj.models.fallbacks || {}) };
    obj.models.per_prompt = { ...def.models.per_prompt, ...(obj.models.per_prompt || {}) };
  }

  if (!obj.auto_install) {
    obj.auto_install = def.auto_install;
  } else {
    obj.auto_install = { ...def.auto_install, ...obj.auto_install };
  }

  if (!obj.ui) {
    obj.ui = def.ui;
  } else {
    obj.ui = { ...def.ui, ...obj.ui };
    obj.ui.banner = { ...def.ui.banner, ...(obj.ui.banner || {}) };
  }

  return obj;
}

export function readConfig(filePath: string): any | null {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, "utf8");
  const yaml = loadYamlSync();
  if (yaml) {
    try {
      return migrateConfig(yaml.parse(text));
    } catch (e: any) {
      throw new Error(`config.yaml: invalid YAML — ${e?.message ?? String(e)}`);
    }
  }
  try {
    return migrateConfig(JSON.parse(text));
  } catch {
    throw new Error("config.yaml requires `yaml` npm package; run npm install yaml");
  }
}
