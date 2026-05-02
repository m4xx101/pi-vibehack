import { describe, it, expect } from "vitest";
import { detectInstalledExtensions } from "../extensions/pi-vibehack/lib/extension-detector.ts";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("detectInstalledExtensions", () => {
  it("finds extensions in globalDir", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-ext-"));
    try {
      const extDir = path.join(tmp, "extensions", "pi-mcp-adapter");
      fs.mkdirSync(extDir, { recursive: true });
      fs.writeFileSync(path.join(extDir, "package.json"), JSON.stringify({ name: "pi-mcp-adapter", version: "1.0.0" }));
      const result = detectInstalledExtensions({ globalDir: path.join(tmp, "extensions"), localDir: "/nonexistent", skillsDir: "/nonexistent" });
      expect(result.extensions["pi-mcp-adapter"]).toBeDefined();
      expect(result.extensions["pi-mcp-adapter"].version).toBe("1.0.0");
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  it("merges global + local extensions (local wins on collision)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-ext-"));
    try {
      const globalExt = path.join(tmp, "global", "memory-mode");
      const localExt = path.join(tmp, "local", "memory-mode");
      fs.mkdirSync(globalExt, { recursive: true });
      fs.mkdirSync(localExt, { recursive: true });
      fs.writeFileSync(path.join(globalExt, "package.json"), JSON.stringify({ name: "memory-mode", version: "1.0.0" }));
      fs.writeFileSync(path.join(localExt, "package.json"), JSON.stringify({ name: "memory-mode", version: "2.0.0" }));
      const result = detectInstalledExtensions({ globalDir: path.join(tmp, "global"), localDir: path.join(tmp, "local"), skillsDir: "/nonexistent" });
      expect(result.extensions["memory-mode"].version).toBe("2.0.0");
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  it("collects skills from skillsDir with valid frontmatter", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-ext-"));
    try {
      const skillDir = path.join(tmp, "skills", "my-skill");
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: my-skill\ndescription: my custom skill\n---\nbody");
      const result = detectInstalledExtensions({ globalDir: "/nonexistent", localDir: "/nonexistent", skillsDir: path.join(tmp, "skills") });
      expect(result.skills.find(s => s.name === "my-skill")).toBeDefined();
      expect(result.skills[0].description).toBe("my custom skill");
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  it("skips skills without SKILL.md", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-ext-"));
    try {
      fs.mkdirSync(path.join(tmp, "skills", "empty-dir"), { recursive: true });
      const result = detectInstalledExtensions({ globalDir: "/nonexistent", localDir: "/nonexistent", skillsDir: path.join(tmp, "skills") });
      expect(result.skills).toEqual([]);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  it("returns empty maps when no dirs exist", () => {
    const result = detectInstalledExtensions({ globalDir: "/nonexistent", localDir: "/nonexistent", skillsDir: "/nonexistent" });
    expect(result.extensions).toEqual({});
    expect(result.skills).toEqual([]);
  });

  it("handles malformed package.json gracefully", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vh-ext-"));
    try {
      const extDir = path.join(tmp, "extensions", "broken");
      fs.mkdirSync(extDir, { recursive: true });
      fs.writeFileSync(path.join(extDir, "package.json"), "{ malformed json");
      const result = detectInstalledExtensions({ globalDir: path.join(tmp, "extensions"), localDir: "/nonexistent", skillsDir: "/nonexistent" });
      expect(result.extensions).toEqual({});
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
});
