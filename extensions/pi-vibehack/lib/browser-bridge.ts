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
