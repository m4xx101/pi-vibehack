// pi-mono's tool result contract (see node_modules/@mariozechner/pi-coding-agent/
// dist/core/tools/render-utils.d.ts):
//
//   { content: Array<{type:"text", text?:string, data?:string, mimeType?:string}>,
//     details?: any }
//
// Pre-1.4.3 every vibehack tool returned a plain object like {report_path, ...}.
// pi-mono's render-utils.js:30 calls `result.content.filter(...)` on whatever
// the tool returns, so an undefined `content` field crashes the TUI on every
// call. This helper wraps any payload into the documented shape:
//
//   ok({foo:1})        →  { content:[{type:"text", text:'{"foo":1}'}], details:{foo:1} }
//   ok("hello world")  →  { content:[{type:"text", text:"hello world"}] }
//   err("bad input")   →  { content:[{type:"text", text:"Error: bad input"}], isError:true }
//
// `details` carries the structured payload through to the LLM (pi-mono mirrors
// it into the tool_result event) so chains can still read structured fields.

export interface PiToolResult {
  content: Array<{ type: "text"; text: string }>;
  details?: any;
  isError?: boolean;
}

function summarize(payload: any): string {
  if (typeof payload === "string") return payload;
  if (payload === null || payload === undefined) return "";
  try { return JSON.stringify(payload, null, 2); }
  catch { return String(payload); }
}

/**
 * Wrap any payload into pi-mono's tool-result shape.
 * Pass a string for a plain text result, or an object — JSON-summarized for
 * the LLM, full payload preserved in `details` for structured consumers.
 */
export function ok(payload: any, opts?: { summary?: string }): PiToolResult {
  const text = opts?.summary ?? summarize(payload);
  return {
    content: [{ type: "text", text: text || "ok" }],
    details: typeof payload === "object" && payload !== null ? payload : undefined,
  };
}

export function err(message: string, payload?: any): PiToolResult {
  const r: PiToolResult = {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
  if (payload !== undefined) r.details = payload;
  return r;
}

/**
 * If a function returns a payload that is already in the {content,details}
 * shape, pass it through; otherwise wrap with `ok`. Used by tools that have
 * many existing return sites.
 */
export function ensureToolResult(payload: any): PiToolResult {
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as any).content) &&
    (payload as any).content.every((c: any) => c && typeof c === "object" && typeof c.type === "string")
  ) {
    return payload as PiToolResult;
  }
  // Existing convention: tools that returned `{error: "..."}` bag are mapped to
  // an isError result so the model sees the failure clearly.
  if (payload && typeof payload === "object" && typeof (payload as any).error === "string") {
    return err((payload as any).error, payload);
  }
  return ok(payload);
}

/**
 * Wrap a Tool definition so its execute() return value is always shaped to
 * pi-mono's contract. Idempotent: re-wrapping is a no-op (we mark the tool
 * with a __resultWrapped sentinel).
 *
 * Use this at registration time so every vibehack tool — old and new — yields
 * a result that pi-mono's render-utils.js can render without crashing.
 */
export function wrapToolResult<T extends { name: string; execute: (...args: any[]) => Promise<any> }>(tool: T): T {
  if ((tool as any).__resultWrapped) return tool;
  const origExecute = tool.execute.bind(tool);
  const wrapped = {
    ...tool,
    __resultWrapped: true,
    async execute(...args: any[]): Promise<PiToolResult> {
      try {
        const raw = await origExecute(...args);
        return ensureToolResult(raw);
      } catch (e: any) {
        // Tools should not throw — but if they do, hand pi-mono a clean
        // isError result rather than letting the TUI crash on undefined.
        return err(`tool ${tool.name} threw: ${e?.message ?? String(e)}`, {
          tool: tool.name,
          stack: typeof e?.stack === "string" ? e.stack.slice(0, 2000) : undefined,
        });
      }
    },
  } as any;
  return wrapped as T;
}
