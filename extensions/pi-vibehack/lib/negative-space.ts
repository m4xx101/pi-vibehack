const REQUIRED_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-frame-options",
  "permissions-policy",
  "referrer-policy",
];

const COMMON_PORTS = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 6379, 8080, 8443];

export interface HeaderFinding { header: string; severity: "info" | "low" | "medium"; }
export interface PortFinding { port: number; severity: "info"; }
export interface DnsFinding { kind: string; severity: "info" | "low" | "medium"; }

export function detectMissingHeaders(headers: Record<string, string>): HeaderFinding[] {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
  const out: HeaderFinding[] = [];
  for (const h of REQUIRED_HEADERS) {
    if (!(h in lower)) {
      const sev = (h === "content-security-policy" || h === "strict-transport-security") ? "medium" : "low";
      out.push({ header: h, severity: sev });
    }
  }
  // SameSite on Set-Cookie is special
  const setCookie = lower["set-cookie"] ?? "";
  if (!/samesite=/i.test(setCookie)) out.push({ header: "set-cookie:samesite", severity: "low" });
  return out;
}

export function detectFilteredPorts(open: Set<number>): PortFinding[] {
  const out: PortFinding[] = [];
  for (const p of COMMON_PORTS) if (!open.has(p)) out.push({ port: p, severity: "info" });
  return out;
}

export function detectMissingDns(records: Record<string, string[]>): DnsFinding[] {
  const out: DnsFinding[] = [];
  const txt = records.TXT ?? [];
  if (!txt.some((t) => /^v=spf1/i.test(t))) out.push({ kind: "SPF", severity: "medium" });
  if (!txt.some((t) => /^v=dmarc1/i.test(t))) out.push({ kind: "DMARC", severity: "medium" });
  // DKIM is host-prefixed; absence at apex TXT is suggestive
  if (!txt.some((t) => /^v=dkim1/i.test(t))) out.push({ kind: "DKIM", severity: "low" });
  return out;
}

export function looksLikeHttpResponse(output: string): boolean {
  return /^HTTP\/[12](\.\d)?\s+\d{3}/m.test(output) || /^[A-Z][a-z]+(-[A-Z][a-z]+)*:\s/m.test(output);
}

export function parseHttpHeaders(output: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const m = /^([A-Za-z][A-Za-z0-9-]*):\s*(.+)$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
