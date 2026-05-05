// v1.3 Phase C — bug-bounty tool catalogue + vibehack_tool_search.

import { describe, it, expect } from "vitest";
import { resetToolCache } from "../extensions/pi-vibehack/lib/tool-detector.ts";

describe("tool catalogue", () => {
  it("ships canonical bug-bounty tools across recon/web/cloud/mobile/network", async () => {
    const { TOOL_CATALOG } = await import("../extensions/pi-vibehack/data/tool-catalog.ts");
    const names = TOOL_CATALOG.map((t) => t.name);
    for (const expected of ["subfinder", "httpx", "nuclei", "ffuf", "sqlmap", "nmap", "frida", "nxc", "prowler"]) {
      expect(names).toContain(expected);
    }
    expect(TOOL_CATALOG.length).toBeGreaterThanOrEqual(25);
  });
});

describe("vibehack_tool_search tool", () => {
  it("ranks tools by query and returns installed flag", async () => {
    resetToolCache();
    const { toolSearchTool } = await import("../extensions/pi-vibehack/tools/tool-search.ts");
    const r: any = await (toolSearchTool as any).execute("c", { query: "subdomain", limit: 5 });
    expect(r.matches.length).toBeGreaterThan(0);
    const top = r.matches[0];
    expect(["subfinder", "amass", "assetfinder"]).toContain(top.name);
    expect(typeof top.installed).toBe("boolean");
  });

  it("filters by domain", async () => {
    const { toolSearchTool } = await import("../extensions/pi-vibehack/tools/tool-search.ts");
    const r: any = await (toolSearchTool as any).execute("c", { domain: "cloud", limit: 10 });
    for (const m of r.matches) {
      expect(m.domain).toContain("cloud");
    }
  });

  it("respects installed_only", async () => {
    const { toolSearchTool } = await import("../extensions/pi-vibehack/tools/tool-search.ts");
    const r: any = await (toolSearchTool as any).execute("c", { installed_only: true, limit: 30 });
    for (const m of r.matches) expect(m.installed).toBe(true);
  });

  it("normalizes alias args", async () => {
    const { toolSearchTool } = await import("../extensions/pi-vibehack/tools/tool-search.ts");
    const out = (toolSearchTool as any).prepareArguments({ search: "xss", area: "web", n: 3 });
    expect(out.query).toBe("xss");
    expect(out.domain).toBe("web");
    expect(out.limit).toBe(3);
  });
});
