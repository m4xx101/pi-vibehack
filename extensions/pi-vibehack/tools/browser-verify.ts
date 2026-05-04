// vibehack_browser_verify (Phase 6 of v1.2) — operator-attached Chrome verifier.
//
// Usage model: operator runs `chrome --remote-debugging-port=9222` (or similar
// Chromium with --remote-debugging-port). This tool discovers a target via
// /json/list, opens a CDP session, navigates to the URL, optionally evaluates
// an expectation expression, and returns the result + a base64 screenshot.
//
// Why not Patchright? Per v1.2 plan: keep the dependency footprint tiny. The
// minimal CDP client lives in lib/cdp-client.ts (~200 LoC, no deps).

import { Type } from "@sinclair/typebox";
import { listTargets, CdpSession } from "../lib/cdp-client.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

export const browserVerifySchema = Type.Object({
  url: Type.String(),
  expectation: Type.Optional(Type.String()),
  port: Type.Optional(Type.Integer({ minimum: 1, maximum: 65535 })),
  host: Type.Optional(Type.String()),
  timeout_ms: Type.Optional(Type.Integer({ minimum: 1000, maximum: 60000 })),
}, { additionalProperties: false });

export const browserVerifyTool = {
  name: "vibehack_browser_verify",
  label: "Verify finding in attached Chrome",
  description:
    "Navigate the operator's Chrome (--remote-debugging-port=9222) to <url>, " +
    "optionally evaluate <expectation> as JS, return its value + a screenshot. " +
    "Returns a friendly error when no Chrome is attached.",
  parameters: browserVerifySchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, {
      target: "url",
      href: "url",
      expect: "expectation",
      assertion: "expectation",
      timeoutMs: "timeout_ms",
      timeout: "timeout_ms",
    }),
  ) as any,

  async execute(
    _callId: string,
    params: { url: string; expectation?: string; port?: number; host?: string; timeout_ms?: number },
    _signal?: any,
    _onUpdate?: any,
    _ctx?: any,
  ): Promise<any> {
    const host = params.host ?? "127.0.0.1";
    const port = params.port ?? 9222;
    const timeoutMs = params.timeout_ms ?? 15_000;

    let targets;
    try {
      targets = await listTargets(host, port);
    } catch (e: any) {
      return {
        error: "no-chrome-attached",
        hint: `start Chrome with --remote-debugging-port=${port} (got: ${e?.message ?? String(e)})`,
      };
    }
    const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
    if (!page?.webSocketDebuggerUrl) {
      return { error: "no-page-target", hint: "open a tab in the attached Chrome and retry" };
    }

    const session = new CdpSession(page.webSocketDebuggerUrl);
    try {
      await session.open(timeoutMs);
      await session.send("Page.enable");
      await session.send("Runtime.enable");

      const loaded = new Promise<void>((resolve) => {
        const off = session.on("Page.loadEventFired", () => { off(); resolve(); });
        setTimeout(() => { off(); resolve(); }, timeoutMs);
      });
      await session.send("Page.navigate", { url: params.url });
      await loaded;

      let evalResult: any = undefined;
      if (params.expectation) {
        try {
          const r = await session.send("Runtime.evaluate", {
            expression: params.expectation,
            returnByValue: true,
            awaitPromise: true,
            timeout: Math.min(timeoutMs, 10_000),
          });
          evalResult = r.exceptionDetails
            ? { error: r.exceptionDetails.text ?? "exception", details: r.exceptionDetails }
            : { value: r.result?.value };
        } catch (e: any) {
          evalResult = { error: String(e?.message ?? e) };
        }
      }

      let screenshot: string | undefined;
      try {
        const r = await session.send("Page.captureScreenshot", { format: "png" });
        screenshot = r.data; // base64 PNG
      } catch {
        screenshot = undefined;
      }

      return {
        url: params.url,
        target_id: page.id,
        evaluation: evalResult,
        screenshot_b64: screenshot,
      };
    } catch (e: any) {
      return { error: "cdp-failed", reason: String(e?.message ?? e) };
    } finally {
      try { session.close(); } catch {}
    }
  },
};
