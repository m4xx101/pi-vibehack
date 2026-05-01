import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setActiveEngagement, engagementDir } from "../../extensions/pi-vibehack/lib/engagement.ts";
import { appendEvent, nowIso } from "../../extensions/pi-vibehack/lib/events.ts";
import { renderEngagement } from "../../extensions/pi-vibehack/render/render-engagement.ts";

// Smoke walks through the design spec §5 turn sequence using simulated tool outputs
// (no actual pi spawn — that requires a configured pi binary in CI).

describe("pi-vibehack DVWA smoke", () => {
  let dataDir: string;
  const prevDataDir = process.env.VIBEHACK_DATA_DIR;

  beforeAll(async () => {
    dataDir = await fs.mkdtemp(join(tmpdir(), "vh-smoke-"));
    process.env.VIBEHACK_DATA_DIR = dataDir;
  });

  afterAll(async () => {
    if (prevDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = prevDataDir;
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("simulated engagement from /vibehack to /vibehack-complete produces tree.md and findings.md", async () => {
    const eng = "smoke-dvwa";
    await setActiveEngagement(eng);
    await fs.mkdir(engagementDir(eng), { recursive: true });

    // T+0: engagement start
    await appendEvent(engagementDir(eng), { ts: nowIso(), engagement_id: eng, event: "engagement_start", metadata: { target: "http://127.0.0.1:8080" } } as any);

    // T+1: root + surface
    await appendEvent(engagementDir(eng), { ts: nowIso(), engagement_id: eng, event: "node_add", node_id: "n_root", parent_id: null, kind: "root", phase: "recon", claim: "DVWA", next_test: "", falsifier: "n/a", confidence: 1, status: "open", evidence: [], cost_tokens: 0, cost_usd: 0, rationale: "engagement start", metadata: {}, requires_browser: false } as any);
    await appendEvent(engagementDir(eng), { ts: nowIso(), engagement_id: eng, event: "node_add", node_id: "n_1a", parent_id: "n_root", kind: "leaf", phase: "exploit", claim: "Default creds admin/password", next_test: "POST /login.php", falsifier: "non-302 redirect", confidence: 0.85, status: "open", evidence: [], cost_tokens: 0, cost_usd: 0, rationale: "default-cred is fastest first probe", metadata: {}, requires_browser: false } as any);

    // T+2: confirm
    await appendEvent(engagementDir(eng), { ts: nowIso(), engagement_id: eng, event: "evidence_add", node_id: "n_1a", evidence: [{ ts: nowIso(), kind: "http_replay", ref: "evidence/n_1a-login.txt", summary: "302 redirect to /index.php — login successful" }] } as any);
    await appendEvent(engagementDir(eng), { ts: nowIso(), engagement_id: eng, event: "confirm", node_id: "n_1a" } as any);

    // Render
    const stats = await renderEngagement(eng);
    expect(stats.nodeCount).toBe(2);
    expect(stats.confirmedCount).toBe(1);

    const treeMd = await fs.readFile(join(engagementDir(eng), "tree.md"), "utf8");
    expect(treeMd).toContain("DVWA");
    expect(treeMd).toContain("Default creds");

    const findingsMd = await fs.readFile(join(engagementDir(eng), "findings.md"), "utf8");
    expect(findingsMd).toContain("## n_1a");
  });
});
