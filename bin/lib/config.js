import * as fs from "node:fs";
import * as path from "node:path";

export const CURRENT_VERSION = 1;

const HYBRID = { planner: "claude-haiku-4-5", operator: "claude-opus-4-7", reporter: "claude-opus-4-7" };
const LOCAL = { planner: "qwen-72b-instruct", operator: "qwen-72b-instruct", reporter: "qwen-72b-instruct" };
const FRONTIER = { planner: "claude-sonnet-4-6", operator: "claude-opus-4-7", reporter: "claude-opus-4-7" };

export function defaultConfig(profile = "hybrid") {
  const map = { hybrid: HYBRID, local: LOCAL, frontier: FRONTIER }[profile] || HYBRID;
  return {
    version: CURRENT_VERSION,
    models: {
      planner: map.planner,
      operator: map.operator,
      reporter: map.reporter,
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

async function loadYaml() {
  try {
    const mod = await import("yaml");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

// Synchronous yaml load — used by readConfig/writeConfig which are sync APIs.
// We use createRequire to get a CJS require handle so we can sync-import yaml.
import { createRequire } from "node:module";
const _require = createRequire(import.meta.url);
function loadYamlSync() {
  try {
    return _require("yaml");
  } catch {
    return null;
  }
}

export function readConfig(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, "utf8");
  const yaml = loadYamlSync();
  if (yaml) {
    try {
      return migrateConfig(yaml.parse(text));
    } catch (e) {
      throw new Error(`config.yaml: invalid YAML — ${e?.message ?? String(e)}`);
    }
  }
  // No yaml package available — fall back to JSON parsing.
  try { return migrateConfig(JSON.parse(text)); }
  catch { throw new Error("config.yaml requires `yaml` npm package; run npm install yaml"); }
}

export function writeConfig(filePath, obj) {
  const yaml = loadYamlSync();
  const text = yaml ? yaml.stringify(obj) : JSON.stringify(obj, null, 2);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

export function migrateConfig(obj) {
  if (!obj || typeof obj !== "object") return defaultConfig();
  const def = defaultConfig();
  if (!obj.version) obj.version = CURRENT_VERSION;

  // models: shallow-merge top-level keys, then deep-merge nested objects.
  if (!obj.models) {
    obj.models = def.models;
  } else {
    obj.models = { ...def.models, ...obj.models };
    obj.models.fallbacks = { ...def.models.fallbacks, ...(obj.models.fallbacks || {}) };
    obj.models.per_prompt = { ...def.models.per_prompt, ...(obj.models.per_prompt || {}) };
  }

  // auto_install: shallow-merge.
  if (!obj.auto_install) {
    obj.auto_install = def.auto_install;
  } else {
    obj.auto_install = { ...def.auto_install, ...obj.auto_install };
  }

  // ui: shallow-merge top-level, deep-merge ui.banner.
  if (!obj.ui) {
    obj.ui = def.ui;
  } else {
    obj.ui = { ...def.ui, ...obj.ui };
    obj.ui.banner = { ...def.ui.banner, ...(obj.ui.banner || {}) };
  }

  return obj;
}
