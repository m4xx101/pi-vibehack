// Phase 3 of v1.2 — appendEvent mirrors to pi.appendEntry("vibehack/<event>",
// payload) when a pi reference has been threaded in.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendEvent, setPiAppendEntry } from "../extensions/pi-vibehack/lib/events.ts";

describe("events.appendEvent → pi.appendEntry mirror", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-mirror-"));
  });

  afterEach(async () => {
    setPiAppendEntry(null);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("calls pi.appendEntry with vibehack/<event> customType", async () => {
    const appendEntry = vi.fn();
    setPiAppendEntry(appendEntry);

    await appendEvent(tmp, {
      ts: new Date().toISOString(),
      engagement_id: "eng-test",
      event: "engagement_start",
      metadata: { target: "example.com" },
    } as any);

    expect(appendEntry).toHaveBeenCalledTimes(1);
    expect(appendEntry.mock.calls[0][0]).toBe("vibehack/engagement_start");
    expect((appendEntry.mock.calls[0][1] as any).engagement_id).toBe("eng-test");
  });

  it("still writes events.jsonl when pi.appendEntry throws", async () => {
    const appendEntry = vi.fn(() => { throw new Error("pi-side fail"); });
    setPiAppendEntry(appendEntry);

    await appendEvent(tmp, {
      ts: new Date().toISOString(),
      engagement_id: "eng-test",
      event: "engagement_start",
      metadata: { target: "example.com" },
    } as any);

    const buf = await fs.readFile(join(tmp, "events.jsonl"), "utf8");
    expect(buf).toContain("engagement_start");
  });

  it("no-ops when pi.appendEntry not threaded", async () => {
    setPiAppendEntry(null);
    await expect(
      appendEvent(tmp, {
        ts: new Date().toISOString(),
        engagement_id: "eng-test",
        event: "engagement_start",
        metadata: { target: "example.com" },
      } as any),
    ).resolves.not.toThrow();
  });
});
