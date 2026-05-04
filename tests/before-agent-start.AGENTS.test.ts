// Phase 2 of v1.2 rewire — before-agent-start should no longer read
// AGENTS.md from disk when the agentsMdCompat flag is false (default).
// pi-mono natively walks cwd for AGENTS.md/CLAUDE.md
// (resource-loader.js:31), so duplicating that work was redundant. The
// compat flag preserves the dual-load for one minor version per the
// plan's Risk #2 mitigation.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

describe("before-agent-start AGENTS.md handling", () => {
  let tmp: string;
  let origDataDir: string | undefined;
  let origReadFile: typeof fs.readFile;
  let readPaths: string[];

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-baStart-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
    readPaths = [];
    origReadFile = fs.readFile;
    // Spy on fs.readFile usage by monkey-patching the same export the hook uses.
    (fs as any).readFile = (async (p: any, ...rest: any[]) => {
      readPaths.push(String(p));
      return (origReadFile as any).call(fs, p, ...rest);
    }) as any;
    // Reset module cache so reimport picks up env.
    vi.resetModules();
  });

  afterEach(async () => {
    (fs as any).readFile = origReadFile;
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("does NOT call fs.readFile on AGENTS.md when compat flag is false (default)", async () => {
    // Set up an active engagement with an AGENTS.md present so we'd notice
    // if the hook reads it.
    const engId = "2026-05-04-test";
    const engDir = join(tmp, "engagements", engId);
    await fs.mkdir(engDir, { recursive: true });
    await fs.writeFile(join(engDir, "AGENTS.md"), "engagement-pinned\n", "utf8");
    await fs.writeFile(join(tmp, "AGENTS.md"), "global-pinned\n", "utf8");
    await fs.writeFile(join(tmp, ".active"), engId, "utf8");

    const { registerBeforeAgentStartHook } = await import(
      "../extensions/pi-vibehack/hooks/before-agent-start.ts"
    );
    let captured: Function | null = null;
    const fakePi: any = {
      on: (event: string, h: Function) => {
        if (event === "before_agent_start") captured = h;
      },
      setActiveTools: () => {},
    };
    registerBeforeAgentStartHook(fakePi);

    await captured!({ systemPrompt: "" }, { ui: { notify: () => {} } });

    const agentsMdHits = readPaths.filter((p) => /AGENTS\.md$/i.test(p));
    expect(agentsMdHits).toEqual([]);
  });

  it("DOES read AGENTS.md when vibehack.agentsMdCompat=true", async () => {
    const engId = "2026-05-04-test2";
    const engDir = join(tmp, "engagements", engId);
    await fs.mkdir(engDir, { recursive: true });
    await fs.writeFile(join(engDir, "AGENTS.md"), "engagement-pinned\n", "utf8");
    await fs.writeFile(join(tmp, ".active"), engId, "utf8");

    // Drop a compat-flag config in the vibehack data dir.
    const cfgDir = join(homedir(), ".pi", "agent", "vibehack");
    // We don't want to actually mutate the user's home dir in a test.
    // Instead, set VIBEHACK_CONFIG_PATH to a tmp config — the hook supports this.
    const cfgPath = join(tmp, "config.yaml");
    await fs.writeFile(cfgPath, "vibehack:\n  agentsMdCompat: true\n", "utf8");
    const origCfg = process.env.VIBEHACK_CONFIG_PATH;
    process.env.VIBEHACK_CONFIG_PATH = cfgPath;

    try {
      vi.resetModules();
      const { registerBeforeAgentStartHook } = await import(
        "../extensions/pi-vibehack/hooks/before-agent-start.ts"
      );
      let captured: Function | null = null;
      const fakePi: any = {
        on: (event: string, h: Function) => {
          if (event === "before_agent_start") captured = h;
        },
        setActiveTools: () => {},
      };
      registerBeforeAgentStartHook(fakePi);
      await captured!({ systemPrompt: "" }, { ui: { notify: () => {} } });

      const agentsMdHits = readPaths.filter((p) => /AGENTS\.md$/i.test(p));
      expect(agentsMdHits.length).toBeGreaterThan(0);
    } finally {
      if (origCfg === undefined) delete process.env.VIBEHACK_CONFIG_PATH;
      else process.env.VIBEHACK_CONFIG_PATH = origCfg;
    }
  });
});
