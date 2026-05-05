// v1.4.2 regression — before-agent-start MUST emit an <engagement_state>
// block with bootstrap=true on a fresh engagement so the planner knows to
// fire vibehack_expand({kind:"root"}) as its first move instead of trying
// to read non-existent tree.md.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("v1.4.2 — engagement_state bootstrap block", () => {
  let tmp: string;
  let origDataDir: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-bootstrap-"));
    origDataDir = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (origDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = origDataDir;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("fresh engagement → bootstrap=true with FIRST MOVE REQUIRED instruction", async () => {
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { appendEvent, nowIso } = await import("../extensions/pi-vibehack/lib/events.ts");
    const { registerBeforeAgentStartHook } =
      await import("../extensions/pi-vibehack/hooks/before-agent-start.ts");

    const eng = newEngagementId("https-duck-store-escape-tech-login");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
    await appendEvent(engagementDir(eng), {
      ts: nowIso(),
      engagement_id: eng,
      event: "engagement_start",
      metadata: { target: "https://duck.store/escape.tech/login" },
    } as any);

    let captured: any = null;
    const setActiveTools = (...args: any[]) => { /* spy */ };
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "before_agent_start") captured = h; },
      setActiveTools,
    };
    registerBeforeAgentStartHook(fakePi);
    const result: any = await captured({ systemPrompt: "" }, { ui: { notify: () => {} } });

    expect(result?.systemPrompt).toContain("<engagement_state>");
    expect(result.systemPrompt).toContain("bootstrap: true");
    expect(result.systemPrompt).toContain("https://duck.store/escape.tech/login");
    expect(result.systemPrompt).toContain("FIRST MOVE REQUIRED");
    expect(result.systemPrompt).toContain('vibehack_expand({parent_id:null, kind:"root"');
  });

  it("post-bootstrap engagement → bootstrap=false, resume hint", async () => {
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { appendEvent, nowIso } = await import("../extensions/pi-vibehack/lib/events.ts");
    const { registerBeforeAgentStartHook } =
      await import("../extensions/pi-vibehack/hooks/before-agent-start.ts");

    const eng = newEngagementId("post-bootstrap");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
    await appendEvent(engagementDir(eng), {
      ts: nowIso(),
      engagement_id: eng,
      event: "engagement_start",
      metadata: { target: "example.com" },
    } as any);
    await appendEvent(engagementDir(eng), {
      ts: nowIso(),
      engagement_id: eng,
      event: "node_add",
      node_id: "n_root",
      parent_id: null,
      kind: "root",
      claim: "example.com",
      next_test: "enumerate",
      status: "open",
    } as any);

    let captured: any = null;
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "before_agent_start") captured = h; },
      setActiveTools: () => {},
    };
    registerBeforeAgentStartHook(fakePi);
    const result: any = await captured({ systemPrompt: "" }, { ui: { notify: () => {} } });

    expect(result.systemPrompt).toContain("bootstrap: false");
    expect(result.systemPrompt).toContain("Resume:");
    expect(result.systemPrompt).not.toContain("FIRST MOVE REQUIRED");
  });

  it("active tools include bash for fallback compatibility", async () => {
    const { setActiveEngagement, newEngagementId, engagementDir } =
      await import("../extensions/pi-vibehack/lib/engagement.ts");
    const { appendEvent, nowIso } = await import("../extensions/pi-vibehack/lib/events.ts");
    const { registerBeforeAgentStartHook } =
      await import("../extensions/pi-vibehack/hooks/before-agent-start.ts");

    const eng = newEngagementId("active-tools-target");
    await fs.mkdir(engagementDir(eng), { recursive: true });
    await setActiveEngagement(eng);
    await appendEvent(engagementDir(eng), {
      ts: nowIso(),
      engagement_id: eng,
      event: "engagement_start",
      metadata: { target: "x" },
    } as any);

    let activeArgs: string[] = [];
    let captured: any = null;
    const fakePi: any = {
      on: (event: string, h: Function) => { if (event === "before_agent_start") captured = h; },
      setActiveTools: (names: string[]) => { activeArgs = names; },
    };
    registerBeforeAgentStartHook(fakePi);
    await captured({ systemPrompt: "" }, { ui: { notify: () => {} } });

    expect(activeArgs).toContain("bash");
    expect(activeArgs).toContain("read");
    expect(activeArgs).toContain("grep");
    expect(activeArgs).toContain("vibehack_expand");
    expect(activeArgs).toContain("vibehack_tool_search");
    expect(activeArgs).toContain("vibehack_load_tools");
  });
});
