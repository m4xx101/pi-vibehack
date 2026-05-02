// Module-level cache to plumb detected extensions/skills from the
// session_start hook to before_provider_request (which doesn't share ctx).
import type { DetectorResult } from "./extension-detector.ts";

let _cached: DetectorResult | null = null;

export function setDetected(result: DetectorResult): void {
  _cached = result;
}

export function getDetected(): DetectorResult | null {
  return _cached;
}

export function clearDetected(): void {
  _cached = null;
}
