// PROFILE_TEMPLATES: install-time templates that seed config.yaml via defaultConfig(profile).
// Profile.js is no longer the runtime source of truth for role->model assignment;
// runtime reads from ~/.pi/agent/vibehack/config.yaml. defaultModelMap remains
// re-exported for backward compatibility with anything that still imports it.
export const PROFILE_TEMPLATES = {
  hybrid:   { planner: "claude-haiku-4-5",   operator: "claude-opus-4-7",       reporter: "claude-opus-4-7" },
  frontier: { planner: "claude-sonnet-4-6",  operator: "claude-opus-4-7",       reporter: "claude-opus-4-7" },
  local:    { planner: "qwen-72b-instruct",  operator: "qwen-72b-instruct",     reporter: "qwen-72b-instruct" },
};

// Backward-compat alias.
export const defaultModelMap = PROFILE_TEMPLATES;

export function resolveProfile({ profile = "hybrid", planner, operator, reporter } = {}) {
  const base = PROFILE_TEMPLATES[profile];
  if (!base) throw new Error(`unknown profile: ${profile}`);
  return {
    profile,
    planner: planner ?? base.planner,
    operator: operator ?? base.operator,
    reporter: reporter ?? base.reporter,
  };
}
