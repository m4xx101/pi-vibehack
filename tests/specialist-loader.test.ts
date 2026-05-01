import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listAvailableSpecialists } from "../extensions/pi-vibehack/lib/specialist-loader.ts";

describe("specialist-loader", () => {
  let tmp: string;
  let prevEnv: string | undefined;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(join(tmpdir(), "vh-spec-test-"));
    prevEnv = process.env.VIBEHACK_DATA_DIR;
    process.env.VIBEHACK_DATA_DIR = tmp;
  });

  afterEach(async () => {
    if (prevEnv === undefined) delete process.env.VIBEHACK_DATA_DIR;
    else process.env.VIBEHACK_DATA_DIR = prevEnv;
    try { await fs.rm(tmp, { recursive: true, force: true }); } catch {}
  });

  it("listAvailableSpecialists includes shipped specialists", async () => {
    const list = await listAvailableSpecialists();
    expect(list).toContain("web-recon");
    expect(list).toContain("web-exploit");
    expect(list).toContain("osint");
  });

  it("listAvailableSpecialists includes operator-grown specialists", async () => {
    const learnedDir = join(tmp, "specialists", "learned", "phishing");
    await fs.mkdir(learnedDir, { recursive: true });
    await fs.writeFile(
      join(learnedDir, "SKILL.md"),
      `---\nname: phishing-specialist\ndescription: Operator-grown phishing specialist.\n---\n\nBody.\n`,
      "utf8",
    );
    const list = await listAvailableSpecialists();
    expect(list).toContain("phishing");
  });
});
