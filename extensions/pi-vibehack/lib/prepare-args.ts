// Shared helpers for tool prepareArguments shims.
//
// The LLM frequently hallucinates camelCase field names (`nodeId`) when the
// schema demands snake_case (`node_id`). prepareArguments runs BEFORE TypeBox
// validation, so we get one chance to normalize aliases.
//
// All shims must be defensive: any throw inside prepareArguments hard-fails
// the tool call (Phase 1 risk #1 in the rewire plan). Wrap callers in
// safePrepare to guarantee that on failure we pass the original args through
// and let validation produce its normal error.

const camelToSnake = (s: string): string =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

/**
 * Generic alias normalizer. For each top-level key:
 *  - If `aliasMap[key]` is set, rename to that target.
 *  - Else convert camelCase → snake_case (idempotent on already-snake keys).
 *  - Trim string values.
 *
 * Does NOT recurse into nested objects/arrays unless `nestedKeys` lists them.
 */
export function normalizeArgs(
  raw: unknown,
  aliasMap: Record<string, string> = {},
  opts: { nestedArrayKeys?: string[]; nestedArrayItemAliases?: Record<string, string> } = {},
): Record<string, unknown> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return raw as any;
  }
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    const target = aliasMap[k] ?? camelToSnake(k);
    let val: unknown = v;
    if (typeof val === "string") val = val.trim();
    if (
      opts.nestedArrayKeys?.includes(target) &&
      Array.isArray(val) &&
      opts.nestedArrayItemAliases
    ) {
      val = (val as unknown[]).map((item) =>
        normalizeArgs(item, opts.nestedArrayItemAliases),
      );
    }
    out[target] = val;
  }
  return out;
}

/**
 * Wrap a prepareArguments shim so that any exception falls back to the
 * original raw args. This protects callers from a buggy shim hard-failing
 * the tool — TypeBox will then produce its normal validation error.
 */
export function safePrepare<T>(fn: (args: unknown) => T): (args: unknown) => T {
  return (args: unknown): T => {
    try {
      return fn(args);
    } catch {
      return args as T;
    }
  };
}
