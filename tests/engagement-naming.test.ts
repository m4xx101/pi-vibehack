// Phase 7 of v1.2: /vibehack handler should call pi.setSessionName so /resume
// shows the engagement target instead of an encoded cwd.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import vibehack from "../extensions/pi-vibehack/index.ts";

describe("vibehack engagement session naming", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-name-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("calls pi.setSessionName('vibehack: <target>') after bootstrap", async () => {
    const setSessionName = vi.fn();
    let captured: any = null;
    const fakePi: any = {
      events: { emit: vi.fn(), on: vi.fn() },
      on: vi.fn(),
      registerTool: vi.fn(),
      registerCommand: (name: string, opts: any) => {
        if (name === "vibehack") captured = opts.handler;
      },
      registerMessageRenderer: vi.fn(),
      setSessionName,
      setActiveTools: vi.fn(),
    };
    vibehack(fakePi);
    expect(captured).toBeTruthy();
    const ctx: any = { ui: { notify: vi.fn() } };
    await captured("example.com", ctx);
    const calls = setSessionName.mock.calls.map((c) => c[0]);
    expect(calls.some((s: string) => s === "vibehack: example.com")).toBe(true);
  });
});
