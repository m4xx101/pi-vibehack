import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

export interface AuthProfile {
  profile_id: string;
  scope: string;
  bearer?: string;
  cookie?: string;
  jwt?: string;
  expiresAt?: string | number;
}

export function scurlConfigPath(cwd?: string): string {
  return join(cwd ?? process.cwd(), ".pi-super-curl", "config.json");
}

export async function detectScurl(): Promise<boolean> {
  try {
    await fs.access(scurlConfigPath());
    return true;
  } catch {}
  try {
    await import("pi-super-curl" as any);
    return true;
  } catch {
    return false;
  }
}

async function readConfig(): Promise<any> {
  try {
    const raw = await fs.readFile(scurlConfigPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function mirrorAuthProfile(profile: AuthProfile): Promise<void> {
  const path = scurlConfigPath();
  const cfg = await readConfig();
  if (!cfg.authProfiles || typeof cfg.authProfiles !== "object") {
    cfg.authProfiles = {};
  }
  cfg.authProfiles[profile.profile_id] = profile;
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(cfg, null, 2), "utf8");
}

export async function readAuthProfiles(scope?: string): Promise<AuthProfile[]> {
  try {
    const cfg = await readConfig();
    const profiles = cfg.authProfiles;
    if (!profiles || typeof profiles !== "object") return [];
    const all = Object.values(profiles) as AuthProfile[];
    if (scope) return all.filter((p) => p && p.scope === scope);
    return all;
  } catch {
    return [];
  }
}
