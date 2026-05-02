import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  extractSignature,
  clusterBySignature,
  runReflection,
  type Leaf,
} from "../extensions/pi-vibehack/lib/reflection.ts";

describe("reflection.ts", () => {
  describe("extractSignature", () => {
    it("returns deterministic stack signature for confirmed leaf", () => {
      const leaf: Leaf = {
        kind: "SQLi",
        recipe: "web-recon",
        specialist: "web-exploit",
        surface: "/login?id=1",
        outcome: "confirmed",
      };
      const sig = extractSignature(leaf);
      expect(sig).toContain("SQLi");
      expect(sig).toContain("web-exploit");
      expect(sig).not.toContain("?id=1");
      expect(sig).toContain("/login");
    });

    it("treats missing recipe/specialist as underscore placeholder", () => {
      const leaf: Leaf = { kind: "XSS", outcome: "confirmed" };
      const sig = extractSignature(leaf);
      expect(sig).toContain("_");
    });
  });

  describe("clusterBySignature", () => {
    it("groups identical signatures (cardinality >= 2)", () => {
      const leaves: Leaf[] = [
        { kind: "SQLi", recipe: "r1", specialist: "s1", outcome: "confirmed" },
        { kind: "SQLi", recipe: "r1", specialist: "s1", outcome: "confirmed" },
        { kind: "XSS",  recipe: "r2", specialist: "s2", outcome: "confirmed" },
      ];
      const clusters = clusterBySignature(leaves);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].leaves).toHaveLength(2);
    });

    it("excludes singleton clusters by default (minCardinality = 2)", () => {
      const leaves: Leaf[] = [
        { kind: "SQLi", outcome: "confirmed" },
        { kind: "XSS", outcome: "confirmed" },
      ];
      expect(clusterBySignature(leaves)).toHaveLength(0);
    });

    it("respects custom minCardinality", () => {
      const leaves: Leaf[] = [
        { kind: "SQLi", outcome: "confirmed" },
      ];
      expect(clusterBySignature(leaves, 1)).toHaveLength(1);
    });
  });

  describe("runReflection", () => {
    function makeEvents(tmp: string, events: any[]): string {
      const eventsPath = path.join(tmp, "events.jsonl");
      fs.writeFileSync(eventsPath, events.map(e => JSON.stringify(e)).join("\n") + "\n");
      return eventsPath;
    }

    it("writes a SKILL.md to skills/learned/ on success cluster", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-refl-"));
      try {
        const eventsPath = makeEvents(tmp, [
          { event: "confirm", engagement_id: "eng-1", node_id: "n1", kind: "SQLi", recipe: "web-recon", specialist: "web-exploit", surface: "/login", ts: "2026-05-02T10:00:00.000Z" },
          { event: "confirm", engagement_id: "eng-1", node_id: "n2", kind: "SQLi", recipe: "web-recon", specialist: "web-exploit", surface: "/login", ts: "2026-05-02T10:00:01.000Z" },
        ]);
        const learnedDir = path.join(tmp, "learned");
        const result = await runReflection({ eventsPath, learnedDir, scope: "manual" });
        expect(result.writtenSkills.length).toBeGreaterThan(0);
        const files = fs.readdirSync(learnedDir, { recursive: true }) as string[];
        expect(files.some(f => f.endsWith("SKILL.md"))).toBe(true);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("skips singleton clusters (cardinality 1)", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-refl-"));
      try {
        const eventsPath = makeEvents(tmp, [
          { event: "confirm", engagement_id: "eng-1", node_id: "n1", kind: "SQLi", recipe: "r", specialist: "s", surface: "/x", ts: "2026-05-02T10:00:00.000Z" },
        ]);
        const learnedDir = path.join(tmp, "learned");
        const result = await runReflection({ eventsPath, learnedDir, scope: "manual" });
        expect(result.writtenSkills).toHaveLength(0);
        if (fs.existsSync(learnedDir)) {
          expect(fs.readdirSync(learnedDir).length).toBe(0);
        }
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("priority: low for cluster of 2-4, high for cluster >= 5", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-refl-"));
      try {
        const lowEvents = [];
        for (let i = 0; i < 3; i++) {
          lowEvents.push({ event: "confirm", engagement_id: "eng-1", node_id: `n${i}`, kind: "SQLi", recipe: "r", specialist: "s", surface: "/login", ts: "2026-05-02T10:00:00.000Z" });
        }
        const eventsPath = makeEvents(tmp, lowEvents);
        const learnedDir = path.join(tmp, "learned");
        await runReflection({ eventsPath, learnedDir, scope: "manual" });
        const files = (fs.readdirSync(learnedDir, { recursive: true }) as string[]).filter(f => f.endsWith("SKILL.md"));
        expect(files.length).toBeGreaterThan(0);
        const skillPath = path.join(learnedDir, files[0]);
        const content = fs.readFileSync(skillPath, "utf8");
        expect(content).toMatch(/priority:\s*low/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("priority: high for cluster of 5+", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-refl-"));
      try {
        const highEvents = [];
        for (let i = 0; i < 5; i++) {
          highEvents.push({ event: "confirm", engagement_id: "eng-1", node_id: `n${i}`, kind: "SQLi", recipe: "r", specialist: "s", surface: "/login", ts: "2026-05-02T10:00:00.000Z" });
        }
        const eventsPath = makeEvents(tmp, highEvents);
        const learnedDir = path.join(tmp, "learned");
        await runReflection({ eventsPath, learnedDir, scope: "manual" });
        const files = (fs.readdirSync(learnedDir, { recursive: true }) as string[]).filter(f => f.endsWith("SKILL.md"));
        const content = fs.readFileSync(path.join(learnedDir, files[0]), "utf8");
        expect(content).toMatch(/priority:\s*high/);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("never writes to skills/recipes/ or skills/specialists/ (shipped territory)", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-refl-"));
      try {
        const eventsPath = makeEvents(tmp, [
          { event: "confirm", engagement_id: "eng-1", node_id: "n1", kind: "SQLi", recipe: "r", specialist: "s", surface: "/x", ts: "2026-05-02T10:00:00.000Z" },
          { event: "confirm", engagement_id: "eng-1", node_id: "n2", kind: "SQLi", recipe: "r", specialist: "s", surface: "/x", ts: "2026-05-02T10:00:01.000Z" },
        ]);
        const learnedDir = path.join(tmp, "learned");
        const result = await runReflection({ eventsPath, learnedDir, scope: "manual" });
        for (const p of result.writtenSkills) {
          expect(p).toMatch(/learned/);
        }
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("handles empty events file gracefully", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-refl-"));
      try {
        const eventsPath = path.join(tmp, "events.jsonl");
        fs.writeFileSync(eventsPath, "");
        const learnedDir = path.join(tmp, "learned");
        const result = await runReflection({ eventsPath, learnedDir, scope: "manual" });
        expect(result.writtenSkills).toEqual([]);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    it("uses 'untargeted' slug for empty/all-symbol kind (slugify discipline)", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-refl-"));
      try {
        const eventsPath = makeEvents(tmp, [
          { event: "confirm", engagement_id: "eng-1", node_id: "n1", kind: "!!!", recipe: "r", specialist: "s", surface: "/x", ts: "2026-05-02T10:00:00.000Z" },
          { event: "confirm", engagement_id: "eng-1", node_id: "n2", kind: "!!!", recipe: "r", specialist: "s", surface: "/x", ts: "2026-05-02T10:00:01.000Z" },
        ]);
        const learnedDir = path.join(tmp, "learned");
        const result = await runReflection({ eventsPath, learnedDir, scope: "manual" });
        expect(result.writtenSkills.some(p => p.includes("untargeted"))).toBe(true);
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });
});
