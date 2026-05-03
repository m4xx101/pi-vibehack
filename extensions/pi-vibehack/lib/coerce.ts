// Shared defensive coercers. pi-mono and JSONL-loaded data sometimes pass
// non-string values where strings are expected (model objects, malformed
// events). These helpers normalize without crashing on `.toLowerCase`/`.trim`.

export function asString(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    if (typeof obj.id === "string") return obj.id;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.model === "string") return obj.model;
  }
  return "";
}
