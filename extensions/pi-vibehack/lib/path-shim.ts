import { promises as fs } from "node:fs";
import { join, delimiter } from "node:path";
import { vibehackRoot } from "./engagement.ts";

export function shimPath(): string {
  return join(vibehackRoot(), "tools", "PATH-shim.sh");
}

async function collectBinDirs(): Promise<string[]> {
  const root = vibehackRoot();
  const toolsDir = join(root, "tools");
  await fs.mkdir(toolsDir, { recursive: true });
  let entries: string[] = [];
  try {
    entries = await fs.readdir(toolsDir);
  } catch {}
  const dirs: string[] = [];
  for (const e of entries) {
    const stat = await fs.stat(join(toolsDir, e)).catch(() => null);
    if (stat?.isDirectory()) {
      const binDir = join(toolsDir, e, "bin");
      try {
        const bs = await fs.stat(binDir);
        if (bs.isDirectory()) dirs.push(binDir);
      } catch {}
    }
  }
  return dirs;
}

export async function writePathShim(): Promise<string> {
  const dirs = await collectBinDirs();
  const body = `# pi-vibehack PATH shim — sourced by spawned subprocesses\nexport PATH="${dirs.join(":")}:$PATH"\n`;
  const p = shimPath();
  await fs.writeFile(p, body, { encoding: "utf8", mode: 0o755 });
  return p;
}

export async function envWithShim(): Promise<NodeJS.ProcessEnv> {
  const bins = await collectBinDirs();
  const oldPath = process.env.PATH ?? "";
  return {
    ...process.env,
    PATH: bins.length ? `${bins.join(delimiter)}${delimiter}${oldPath}` : oldPath,
  };
}
