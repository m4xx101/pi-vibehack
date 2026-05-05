// Specialist persona registry (v1.3, CyberStrike-inspired).
//
// CyberStrike ships 13+ domain agents (web-application / mobile / cloud-security /
// internal-network + 8 vuln-class proxy testers). Tab cycles between them. Each
// agent injects a domain-specific system prompt and biases tool selection.
//
// pi-vibehack v1.3 adopts the same idea: a small registry of named personas
// each with a canonical system-prompt body. The active persona is per-engagement
// state, swapped via /persona <name> or vibehack_use_persona. before-agent-start
// reads the active persona and prepends its body to the system prompt block.
//
// We do NOT spawn separate sub-agents per persona (CyberStrike does, but it
// adds substantial complexity). Instead we re-bias the same Planner with the
// persona's prompt body — same hypothesis tree, different lens.

import { promises as fs } from "node:fs";
import { join } from "node:path";
import { engagementDir, vibehackRoot } from "./engagement.ts";

export interface PersonaDef {
  name: string;
  label: string;
  domain: "web" | "mobile" | "cloud" | "network" | "vuln-class" | "general";
  description: string;
  body: string;
}

// The shipped persona catalogue. Bodies are short — a paragraph of methodology
// + the OWASP/CIS/MASTG family the persona maps onto. The Planner already has
// the broad system prompt; persona is a lens, not a replacement.
export const PERSONAS: Record<string, PersonaDef> = {
  general: {
    name: "general",
    label: "General",
    domain: "general",
    description: "Default offensive-security generalist. No specialization bias.",
    body: "",
  },
  "web-application": {
    name: "web-application",
    label: "Web Application",
    domain: "web",
    description: "OWASP Top 10 + WSTG methodology. API + session testing.",
    body: [
      "<persona name=web-application>",
      "Scope: web applications and APIs.",
      "Methodology: OWASP WSTG v4.2 sections 02 (info gathering) → 04 (auth) → 05 (authz) → 06 (session) → 07 (input validation) → 08 (error handling) → 09 (crypto) → 10 (business logic) → 11 (client-side) → 12 (API).",
      "Bias: prefer expand kinds {SQL-val, SQL-ident, HTML-text, HTML-attribute-value, JS-string, URL-path, URL-query, JSON-key, header, cookie, multipart-field}.",
      "Always check authn boundaries before authz. Always confirm session-fixation/CSRF before chaining business-logic.",
      "</persona>",
    ].join("\n"),
  },
  "mobile-application": {
    name: "mobile-application",
    label: "Mobile Application",
    domain: "mobile",
    description: "Android/iOS, Frida/Objection, MASTG/MASVS compliance.",
    body: [
      "<persona name=mobile-application>",
      "Scope: native + hybrid mobile apps.",
      "Methodology: OWASP MASTG. MASVS-AUTH → MASVS-CODE → MASVS-CRYPTO → MASVS-NETWORK → MASVS-PLATFORM → MASVS-RESILIENCE → MASVS-STORAGE.",
      "Bias: expand kinds {deep-link, intent-extra, ipc-message, content-provider-uri, jni-call, keychain-key, exported-activity, javascript-bridge}.",
      "Tools: Frida, Objection, MobSF, jadx, apktool, frida-ios-dump, idevicepair.",
      "</persona>",
    ].join("\n"),
  },
  "cloud-security": {
    name: "cloud-security",
    label: "Cloud Security",
    domain: "cloud",
    description: "AWS / Azure / GCP. IAM misconfig, exposed resources, CIS benchmarks.",
    body: [
      "<persona name=cloud-security>",
      "Scope: AWS, Azure, GCP misconfigurations and IAM/identity escalation.",
      "Methodology: CIS benchmarks per provider; Stratus Red Team TTPs; NIST SP800-171.",
      "Bias: expand kinds {iam-policy-statement, s3-bucket-acl, sts-role, kms-key-policy, security-group-rule, gcp-service-account, azure-role-assignment, k8s-rbac}.",
      "Always enumerate IMDS / metadata before pivoting; chain SSRF→IMDS→cloud-account-takeover terminal.",
      "</persona>",
    ].join("\n"),
  },
  "internal-network": {
    name: "internal-network",
    label: "Internal Network",
    domain: "network",
    description: "Active Directory, Kerberos, lateral movement, pivoting.",
    body: [
      "<persona name=internal-network>",
      "Scope: internal Windows/Linux networks, Active Directory, Kerberos.",
      "Methodology: PTES post-exploitation phase + ATT&CK Lateral Movement (TA0008) + Discovery (TA0007).",
      "Bias: expand kinds {smb-share, kerberos-spn, ldap-attribute, gpo-policy, dcom-method, wmi-class, ssh-key, sudo-rule}.",
      "Tools: BloodHound, Rubeus, Mimikatz/secretsdump, CrackMapExec/NetExec, Responder, Impacket suite, PowerView.",
      "</persona>",
    ].join("\n"),
  },
  idor: {
    name: "idor",
    label: "IDOR / BOLA",
    domain: "vuln-class",
    description: "Insecure Direct Object Reference / Broken Object-Level Auth.",
    body: [
      "<persona name=idor>",
      "Vuln class: IDOR / BOLA. Numeric ID enumeration + path/query/body/header/cookie pivots.",
      "Bias: expand kinds {URL-path, URL-query, JSON-key, header, cookie}.",
      "Always test horizontal (peer object) AND vertical (privilege tier) traversal. PII sanitize before promoting to wiki.",
      "</persona>",
    ].join("\n"),
  },
  "auth-bypass": {
    name: "auth-bypass",
    label: "Auth Bypass",
    domain: "vuln-class",
    description: "Authentication bypass / authorization bypass.",
    body: [
      "<persona name=auth-bypass>",
      "Vuln class: authn / authz bypass.",
      "Methodology: WSTG-ATHN + WSTG-ATHZ. Test {default-creds, MFA-bypass, JWT-confusion, SAML-replay, OAuth-state-mismatch, role-mass-assignment, IDOR-on-admin-endpoints}.",
      "</persona>",
    ].join("\n"),
  },
  "mass-assignment": {
    name: "mass-assignment",
    label: "Mass Assignment",
    domain: "vuln-class",
    description: "Mass assignment / over-posting on JSON+form endpoints.",
    body: [
      "<persona name=mass-assignment>",
      "Vuln class: mass assignment.",
      "Methodology: enumerate model fields via API responses → submit unexpected fields {role, isAdmin, owner_id, balance, verified} on PATCH/PUT/POST → verify privilege change.",
      "</persona>",
    ].join("\n"),
  },
  injection: {
    name: "injection",
    label: "Injection",
    domain: "vuln-class",
    description: "SQLi / NoSQLi / LDAPi / XPath / OS-command / template injection.",
    body: [
      "<persona name=injection>",
      "Vuln class: injection (SQLi/NoSQLi/LDAPi/XPath/OS-command/SSTI).",
      "Bias: expand kinds {SQL-val, SQL-ident, NoSQL-key, LDAP-filter, XPath-expr, command-arg, template-expr}.",
      "Stage: detect (error/timing/diff) → confirm (boolean/UNION) → exploit (data-extraction/RCE).",
      "</persona>",
    ].join("\n"),
  },
  "business-logic": {
    name: "business-logic",
    label: "Business Logic",
    domain: "vuln-class",
    description: "Race conditions, state machine flaws, workflow bypass.",
    body: [
      "<persona name=business-logic>",
      "Vuln class: business logic flaws.",
      "Methodology: model the workflow as a state machine → identify illegal transitions → test {time-of-check-time-of-use, race-condition, parameter-tampering, workflow-skipping, unit-confusion, integer-rollover, negative-quantity}.",
      "</persona>",
    ].join("\n"),
  },
  ssrf: {
    name: "ssrf",
    label: "SSRF",
    domain: "vuln-class",
    description: "Server-Side Request Forgery + cloud IMDS pivots.",
    body: [
      "<persona name=ssrf>",
      "Vuln class: SSRF.",
      "Methodology: in-band detection (server fetches arbitrary URL) → cloud-IMDS pivots (AWS 169.254.169.254, GCP metadata.google.internal, Azure 169.254.169.254) → blind-OOB via canary → chain to cloud-account-takeover or internal-service RCE.",
      "</persona>",
    ].join("\n"),
  },
  "file-attacks": {
    name: "file-attacks",
    label: "File Attacks",
    domain: "vuln-class",
    description: "Upload bypass, path traversal, polyglot, file inclusion.",
    body: [
      "<persona name=file-attacks>",
      "Vuln class: file-related vulns.",
      "Tests: {double-extension-upload, magic-byte-spoof, content-type-pivot, path-traversal-in-filename, polyglot-PNG-PHP, LFI, RFI, XXE-via-upload, ZipSlip, XML/XLS-bomb}.",
      "</persona>",
    ].join("\n"),
  },
};

const ACTIVE_FILE = ".active-persona";

export async function setActivePersona(eng: string, name: string): Promise<void> {
  if (!PERSONAS[name]) throw new Error(`unknown persona: ${name}`);
  const dir = engagementDir(eng);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, ACTIVE_FILE), name, "utf8");
}

export async function getActivePersona(eng: string): Promise<PersonaDef> {
  try {
    const name = (await fs.readFile(join(engagementDir(eng), ACTIVE_FILE), "utf8")).trim();
    return PERSONAS[name] ?? PERSONAS.general;
  } catch {
    return PERSONAS.general;
  }
}

export function listPersonas(): PersonaDef[] {
  return Object.values(PERSONAS);
}

export function getPersonaBody(name: string): string {
  return PERSONAS[name]?.body ?? "";
}

// Convenience for tests / external callers: read raw active persona name.
export async function getActivePersonaName(eng: string): Promise<string> {
  try {
    return (await fs.readFile(join(engagementDir(eng), ACTIVE_FILE), "utf8")).trim();
  } catch {
    return "general";
  }
}

// Suppress unused warning in environments where vibehackRoot stays optional.
export const _vibehackRoot = vibehackRoot;
