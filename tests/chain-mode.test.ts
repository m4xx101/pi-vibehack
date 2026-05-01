import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findLatestProposal } from "../extensions/pi-vibehack/lib/chain-runner.ts";
import { setActiveEngagement, engagementDir } from "../extensions/pi-vibehack/lib/engagement.ts";
import { appendEvent, nowIso } from "../extensions/pi-vibehack/lib/events.ts";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), "vh-chain-"));
  process.env.VIBEHACK_DATA_DIR = root;
  await setActiveEngagement("e1");
  await fs.mkdir(engagementDir("e1"), { recursive: true });
});
afterEach(async () => {
  delete process.env.VIBEHACK_DATA_DIR;
  await fs.rm(root, { recursive: true, force: true });
});

describe("findLatestProposal", () => {
  it("returns the most recent unresolved proposal", async () => {
    await appendEvent(engagementDir("e1"), {
      ts: nowIso(),
      engagement_id: "e1",
      event: "chain_propose",
      node_id: "n_3b",
      metadata: {
        steps: [{ node_id: "n_4a", next_test: "x", expected_outcome: "y" }],
        is_destructive: false,
      },
    } as any);
    const p = await findLatestProposal("e1");
    expect(p).not.toBeNull();
    expect(p!.root_node_id).toBe("n_3b");
    expect(p!.steps.length).toBe(1);
    expect(p!.is_destructive).toBe(false);
  });

  it("returns null when last proposal is already resolved", async () => {
    await appendEvent(engagementDir("e1"), {
      ts: nowIso(),
      engagement_id: "e1",
      event: "chain_propose",
      node_id: "n_3b",
      metadata: {
        steps: [{ node_id: "n_4a", next_test: "x", expected_outcome: "y" }],
        is_destructive: false,
      },
    } as any);
    await appendEvent(engagementDir("e1"), {
      ts: nowIso(),
      engagement_id: "e1",
      event: "chain_reject",
      node_id: "n_3b",
    } as any);
    const p = await findLatestProposal("e1");
    expect(p).toBeNull();
  });
});
