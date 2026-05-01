import { promises as fs } from "node:fs";
import { dirname } from "node:path";

export async function readSettings(path) {
  try {
    const buf = await fs.readFile(path, "utf8");
    return JSON.parse(buf);
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}

export async function writeSettings(path, settings) {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

/**
 * Add a versioned npm: package spec to the settings.json `packages` array.
 *
 * @param {string} path     Absolute path to settings.json (created if missing).
 * @param {string} pkgSpec  Full spec, e.g. `npm:@m4xx101/pi-vibehack@1.0.0` or `npm:foo@1.0.0`.
 *                          MUST include a version (an `@<version>` suffix). Throws if missing —
 *                          unversioned specs would collapse the namePrefix to the package
 *                          scope marker and silently nuke unrelated scoped entries.
 *
 * Idempotent: if a different version of the same package already exists, it is replaced.
 * Re-adding the exact same spec is a no-op (file is still rewritten — a future optimization).
 */
export async function addPackage(path, pkgSpec) {
  // Strip the trailing `@<version>` to derive the name prefix. The pattern requires
  // at least one preceding char (lookbehind) so scoped specs like
  // `npm:@scope/foo@1.0.0` strip only `@1.0.0`, not the leading `@scope` marker.
  const stripped = pkgSpec.replace(/(?<=.)@[^@/]+$/, "");
  if (stripped === pkgSpec) {
    throw new Error(`addPackage requires a versioned spec (got "${pkgSpec}"); add an "@<version>" suffix`);
  }
  const s = await readSettings(path);
  s.packages = Array.isArray(s.packages) ? s.packages : [];
  s.packages = s.packages.filter((p) => !p.startsWith(stripped + "@") && p !== stripped);
  s.packages.push(pkgSpec);
  await writeSettings(path, s);
}

export async function removePackage(path, matcher) {
  const s = await readSettings(path);
  if (!Array.isArray(s.packages)) return;
  s.packages = s.packages.filter((p) => !matcher.test(p));
  await writeSettings(path, s);
}
