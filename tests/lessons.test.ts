import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendLesson,
  readLessons,
  distillFromEngagement,
  type Lesson,
} from "../extensions/pi-vibehack/lib/lessons.ts";
import { engagementDir } from "../extensions/pi-vibehack/lib/engagement.ts";
import { nowIso } from "../extensions/pi-vibehack/lib/events.ts";

let prevDataDir: string | undefined;
let dir: string;

beforeEach(async () => {
  prevDataDir = process.env.VIBEHACK_DATA_DIR;
  dir = await fs.mkdtemp(join(tmpdir(), "vibehack-lessons-"));
  process.env.VIBEHACK_DATA_DIR = dir;
});

afterEach(async () => {
  if (prevDataDir === undefined) delete process.env.VIBEHACK_DATA_DIR;
  else process.env.VIBEHACK_DATA_DIR = prevDataDir;
  await fs.rm(dir, { recursive: true, force: true });
});

describe("lessons", () => {
  it("appendLesson + readLessons roundtrip", async () => {
    const l1: Lesson = {
      ts: nowIso(),
      engagement_id: "eng-1",
      situation: "recon: app exposes /admin",
      action: "fetch /admin and inspect status",
      outcome: "confirmed (confidence=0.90)",
      confidence: 0.9,
    };
    const l2: Lesson = {
      ts: nowIso(),
      engagement_id: "eng-1",
      situation: "exploit: SSRF via image proxy",
      action: "request internal metadata endpoint",
      outcome: "confirmed (confidence=0.85)",
      confidence: 0.85,
    };
    await appendLesson(l1);
    await appendLesson(l2);
    const got = await readLessons();
    expect(got).toHaveLength(2);
    expect(got[0]).toEqual(l1);
    expect(got[1]).toEqual(l2);
  });

  it("distillFromEngagement extracts confirmed leaves", async () => {
    const engId = "2026-05-02-target";
    const engPath = engagementDir(engId);
    await fs.mkdir(engPath, { recursive: true });
    const ts = nowIso();
    const events = [
      {
        ts,
        engagement_id: engId,
        event: "engagement_start",
      },
      {
        ts,
        engagement_id: engId,
        event: "node_add",
        node_id: "n_root",
        parent_id: null,
        kind: "root",
        phase: "recon",
        claim: "engagement root",
        status: "open",
      },
      {
        ts,
        engagement_id: engId,
        event: "node_add",
        node_id: "n_1a",
        parent_id: "n_root",
        kind: "leaf",
        phase: "exploit",
        claim: "/admin is publicly reachable",
        next_test: "GET /admin and check status code",
        status: "open",
        confidence: 0.7,
      },
      {
        ts,
        engagement_id: engId,
        event: "confirm",
        node_id: "n_1a",
      },
    ];
    await fs.writeFile(
      join(engPath, "events.jsonl"),
      events.map((e) => JSON.stringify(e)).join("\n") + "\n",
      "utf8",
    );
    const lessons = await distillFromEngagement(engPath);
    expect(lessons).toHaveLength(1);
    expect(lessons[0].engagement_id).toBe(engId);
    expect(lessons[0].action).toBe("GET /admin and check status code");
    expect(lessons[0].situation).toContain("exploit");
    expect(lessons[0].situation).toContain("/admin is publicly reachable");
    expect(lessons[0].outcome).toContain("confirmed");
  });
});
