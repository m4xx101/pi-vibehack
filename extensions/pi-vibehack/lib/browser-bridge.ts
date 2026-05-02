import { spawn } from "node:child_process";

export type BrowserBackend = "surf-cli" | "playwright" | "none";

export async function detectBrowserBackend(): Promise<BrowserBackend> {
  if (await binExists("surf")) return "surf-cli";
  if (await binExists("playwright") || await binExists("npx")) return "playwright";
  return "none";
}

function binExists(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const opts = process.platform === "win32" ? { stdio: "ignore" as const, shell: true } : { stdio: "ignore" as const };
      const c = spawn(name, ["--version"], opts);
      c.on("error", () => resolve(false));
      c.on("close", (code) => resolve(code === 0));
    } catch { resolve(false); }
  });
}

export function recipeForBackend(b: BrowserBackend): string | null {
  if (b === "surf-cli") return "surf-cli-recipes";
  if (b === "playwright") return "playwright-cli-recipes";
  return null;
}

/**
 * Lazy install hook — call at a browser dispatch site when backend is "none".
 * Caller supplies a `confirm(question, detail) => Promise<boolean>` (e.g. ctx.ui.confirm).
 * If user confirms, attempts `npm i -g surf-cli` and returns the new backend.
 * If declined or no confirm fn available, returns "none" and the caller should
 * traverse the browser fallback chain (see fallbackFor("browser") in soft-dep-installer).
 */
export async function ensureBrowserBackend(
  confirm?: (q: string, d?: string) => Promise<boolean>,
): Promise<BrowserBackend> {
  const have = await detectBrowserBackend();
  if (have !== "none") return have;
  if (!confirm) return "none";
  const yes = await confirm(
    "⚠ leaf needs browser automation. Install surf-cli now?",
    "y) install via npm  ·  n) fall back to playwright/raw-cdp",
  );
  if (!yes) return "none";
  const { installNpmGlobal } = await import("./soft-dep-installer.ts");
  if (!installNpmGlobal("surf-cli").ok) return "none";
  return await detectBrowserBackend();
}
