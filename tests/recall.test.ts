import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recall } from "../extensions/pi-vibehack/graph/recall.ts";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), "vh-recall-"));
  process.env.VIBEHACK_DATA_DIR = root;
  await fs.mkdir(join(root, "engagements", "e1"), { recursive: true });
  await fs.writeFile(
    join(root, "engagements", "e1", "events.jsonl"),
    [
      JSON.stringify({ ts: "x", engagement_id: "e1", event: "node_add", claim: "JBoss 6.1 admin console" }),
      JSON.stringify({
        ts: "x",
        engagement_id: "e1",
        event: "evidence_add",
        evidence: [{ ts: "x", kind: "shell_output", ref: "x", summary: "default jboss/jboss creds" }],
      }),
    ].join("\n"),
    "utf8",
  );
});
afterEach(async () => {
  delete process.env.VIBEHACK_DATA_DIR;
  await fs.rm(root, { recursive: true, force: true });
});

describe("recall fallback", () => {
  it("greps events.jsonl when graphify is unavailable", async () => {
    const r = await recall("jboss");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].source).toBe("fallback-grep");
    expect(r[0].notes.some((n) => n.toLowerCase().includes("jboss"))).toBe(true);
  });
});
