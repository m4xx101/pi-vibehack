// Canary primitives (Phase 12) — file + HTTP callback markers used by
// vibehack_canary_verify to ground exploit verification in observable retrieval.
//
// Two kinds today:
//   - filesystem: write a UUID-tagged file under engagement evidence/ and hand
//     the secret to the Planner so it can craft an exfil test. Self-verify is
//     not possible (only the operator/target can confirm the file was read);
//     verifyCanary returns false for filesystem canaries.
//   - http-callback: spin up an ephemeral 127.0.0.1 HTTP listener on port :0,
//     log every hit to evidence/canary-<uuid>-callbacks.jsonl. verifyCanary
//     returns true if any hit was logged.
//
// Listener registry is per-engagementDir so /vibehack-complete can sweep just
// the active engagement's listeners. cleanupCanaries is idempotent and never
// removes file canaries (kept for forensic record).

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as http from "http";

export interface FileCanary {
  uuid: string;
  ref: string;
  kind: "filesystem";
  secret: string;
  engagementDir: string;
}

export interface HttpCanary {
  uuid: string;
  callback_url: string;
  kind: "http-callback";
  port: number;
  engagementDir: string;
}

export type Canary = FileCanary | HttpCanary;

// Per-engagementDir listener registry. Module-level state — fine because the
// Planner is single-process and listeners are cleaned up on /vibehack-complete.
const HTTP_LISTENERS = new Map<string, http.Server[]>();

function listenersFor(engagementDir: string): http.Server[] {
  if (!HTTP_LISTENERS.has(engagementDir)) HTTP_LISTENERS.set(engagementDir, []);
  return HTTP_LISTENERS.get(engagementDir)!;
}

export function plantFileCanary(engagementDir: string, _kind: string): FileCanary {
  const uuid = crypto.randomUUID();
  const secret = crypto.randomBytes(16).toString("hex");
  const evidenceDir = path.join(engagementDir, "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const ref = path.join(evidenceDir, `canary-${uuid}.txt`);
  fs.writeFileSync(ref, `VIBEHACK_CANARY_${uuid}_${secret}\n`, "utf8");
  return { uuid, ref, kind: "filesystem", secret, engagementDir };
}

export async function plantHttpCallbackCanary(
  engagementDir: string,
  requestedPort = 0,
): Promise<HttpCanary> {
  const uuid = crypto.randomUUID();
  const evidenceDir = path.join(engagementDir, "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const callbackLog = path.join(evidenceDir, `canary-${uuid}-callbacks.jsonl`);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const entry = {
          ts: new Date().toISOString(),
          method: req.method,
          url: req.url,
          headers: req.headers,
        };
        fs.appendFileSync(callbackLog, JSON.stringify(entry) + "\n");
      } catch {
        /* swallow log error — listener must not crash on disk failure */
      }
      res.statusCode = 204;
      res.end();
    });
    server.on("error", reject);
    server.listen(requestedPort, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      listenersFor(engagementDir).push(server);
      resolve({
        uuid,
        callback_url: `http://127.0.0.1:${port}/${uuid}`,
        kind: "http-callback",
        port,
        engagementDir,
      });
    });
  });
}

export interface VerifyResult {
  verified: boolean;
  evidence_ref?: string;
  retrieval_time_ms?: number;
}

export function verifyCanary(canary: Canary): VerifyResult {
  if (canary.kind === "http-callback") {
    const log = path.join(
      canary.engagementDir,
      "evidence",
      `canary-${canary.uuid}-callbacks.jsonl`,
    );
    try {
      if (fs.existsSync(log) && fs.statSync(log).size > 0) {
        return { verified: true, evidence_ref: log };
      }
    } catch {
      /* fall through to unverified */
    }
    return { verified: false };
  }
  // Filesystem: requires operator cross-check (target's exfil log) — Phase 12
  // leaves this as harness API only. The Planner verifies file canary retrieval
  // out-of-band by checking exfil channel content for the secret.
  return { verified: false };
}

export async function cleanupCanaries(engagementDir: string): Promise<void> {
  const servers = listenersFor(engagementDir);
  for (const server of servers) {
    try {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    } catch {
      /* ignore — already closed */
    }
  }
  HTTP_LISTENERS.delete(engagementDir);
  // File canaries stay on disk for forensic record. Operator can rm if desired.
}

/**
 * Test/lifecycle helper: stop all listeners across all engagement dirs.
 * Used in test cleanup and emergency shutdown; not part of the public API.
 */
export async function _cleanupAllListeners(): Promise<void> {
  const dirs = [...HTTP_LISTENERS.keys()];
  for (const dir of dirs) {
    await cleanupCanaries(dir);
  }
}
