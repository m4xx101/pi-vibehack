// v1.4 Phase 2 — autonomous-mode loop driver.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("auto-loop state", () => {
  let tmp: string;
  let origDataDir: string | undefined;
  let eng: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-auto-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    eng = newEngagementId("auto-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("startAutoMode → readAutoMode round-trips with clamped budget", async () => {
    const { startAutoMode, readAutoMode } = await import("../extensions/pi-vibehack/lib/auto-loop.ts");
    const st = await startAutoMode(eng, 999); // way over the 50 cap
    expect(st.enabled).toBe(true);
    expect(st.max_turns).toBe(50);
    const back = await readAutoMode(eng);
    expect(back.enabled).toBe(true);
    expect(back.max_turns).toBe(50);
    expect(back.turns_used).toBe(0);
  });

  it("bumpTurn increments and auto-halts at budget", async () => {
    const { startAutoMode, bumpTurn, readAutoMode } = await import("../extensions/pi-vibehack/lib/auto-loop.ts");
    await startAutoMode(eng, 2);
    let st = await bumpTurn(eng);
    expect(st.turns_used).toBe(1);
    expect(st.enabled).toBe(true);
    st = await bumpTurn(eng);
    expect(st.turns_used).toBe(2);
    expect(st.enabled).toBe(false);
    expect(st.halted_reason).toMatch(/budget exhausted/);
    const persisted = await readAutoMode(eng);
    expect(persisted.enabled).toBe(false);
  });

  it("haltAutoMode persists reason", async () => {
    const { startAutoMode, haltAutoMode, readAutoMode } = await import("../extensions/pi-vibehack/lib/auto-loop.ts");
    await startAutoMode(eng, 5);
    await haltAutoMode(eng, "operator stop");
    const back = await readAutoMode(eng);
    expect(back.enabled).toBe(false);
    expect(back.halted_reason).toBe("operator stop");
  });
});

describe("agent_end hook fires sendUserMessage when auto-mode active", () => {
  let tmp: string;
  let origDataDir: string | undefined;
  let eng: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-end-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    eng = newEngagementId("end-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("sends a follow-up when enabled + budget remains", async () => {
    const { startAutoMode } = await import("../extensions/pi-vibehack/lib/auto-loop.ts");
    const { registerAgentEndHook } = await import("../extensions/pi-vibehack/hooks/agent-end.ts");
    await startAutoMode(eng, 5);

    const sendUserMessage = vi.fn();
    let captured: Function | null = null;
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "agent_end") captured = h; },
      sendUserMessage,
    };
    registerAgentEndHook(fakePi);
    await captured!({}, { ui: { notify: () => {} } });
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    const [msg, opts] = sendUserMessage.mock.calls[0];
    expect(String(msg)).toMatch(/auto-mode turn 1\/5/);
    expect(opts?.deliverAs).toBe("followUp");
  });

  it("does NOT send a follow-up when auto-mode disabled", async () => {
    const { registerAgentEndHook } = await import("../extensions/pi-vibehack/hooks/agent-end.ts");
    const sendUserMessage = vi.fn();
    let captured: Function | null = null;
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "agent_end") captured = h; },
      sendUserMessage,
    };
    registerAgentEndHook(fakePi);
    await captured!({}, { ui: { notify: () => {} } });
    expect(sendUserMessage).not.toHaveBeenCalled();
  });

  it("halts on completion (zero open nodes) before consuming budget", async () => {
    // Minimal engagement: 1 node added + confirmed. foldNodes → 1 node, all closed.
    const { engagementDir } = await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { appendEvent, nowIso } = await import("../extensions/pi-vibehack/lib/events.ts");
    await appendEvent(engagementDir(eng), {
      ts: nowIso(), engagement_id: eng, event: "node_add",
      node_id: "n_1a", parent_id: null, kind: "hypothesis",
      claim: "test", next_test: "x", status: "open", evidence: [],
    } as any);
    await appendEvent(engagementDir(eng), {
      ts: nowIso(), engagement_id: eng, event: "confirm",
      node_id: "n_1a", status: "confirmed",
      evidence: [{ ts: nowIso(), kind: "manual", ref: "r", summary: "s" }],
    } as any);

    const { startAutoMode, readAutoMode } = await import("../extensions/pi-vibehack/lib/auto-loop.ts");
    const { registerAgentEndHook } = await import("../extensions/pi-vibehack/hooks/agent-end.ts");
    await startAutoMode(eng, 5);

    const sendUserMessage = vi.fn();
    let captured: Function | null = null;
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "agent_end") captured = h; },
      sendUserMessage,
    };
    registerAgentEndHook(fakePi);
    await captured!({}, { ui: { notify: () => {} } });
    expect(sendUserMessage).not.toHaveBeenCalled();
    const back = await readAutoMode(eng);
    expect(back.enabled).toBe(false);
    expect(back.halted_reason).toMatch(/resolved/);
  });
});
