export const defaultModelMap = {
  hybrid:   { planner: "claude-haiku-4-5",   operator: "claude-opus-4-7",       reporter: "claude-opus-4-7" },
  frontier: { planner: "claude-sonnet-4-6",  operator: "claude-opus-4-7",       reporter: "claude-opus-4-7" },
  local:    { planner: "qwen-72b-instruct",  operator: "qwen-72b-instruct",     reporter: "qwen-72b-instruct" },
};

export function resolveProfile({ profile = "hybrid", planner, operator, reporter } = {}) {
  const base = defaultModelMap[profile];
  if (!base) throw new Error(`unknown profile: ${profile}`);
  return {
    profile,
    planner: planner ?? base.planner,
    operator: operator ?? base.operator,
    reporter: reporter ?? base.reporter,
  };
}
