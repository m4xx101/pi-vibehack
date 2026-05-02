// extensions/pi-vibehack/lib/evaluator.ts

export interface ExpectedFinding {
  kind: string;
  surface?: string;
  severity?: string;
  phase?: string;
  canary_token?: string;
}

export interface ExpectedFindingsFile {
  target?: string;
  class?: string;
  expected_findings: ExpectedFinding[];
  fail_on_missing?: string[];
  allow_extras?: boolean;
}

export interface ActualFinding {
  kind: string;
  surface?: string;
}

export interface EvalResult {
  passed: boolean;
  matched: ExpectedFinding[];
  missing: string[];      // kinds from fail_on_missing that didn't match
  extras: ActualFinding[];
}

export function evaluateBench(expected: ExpectedFindingsFile, actual: ActualFinding[]): EvalResult {
  const allowExtras = expected.allow_extras ?? true;
  const failOnMissing = expected.fail_on_missing ?? [];

  // Match expected findings against actual
  const matched: ExpectedFinding[] = [];
  for (const exp of expected.expected_findings) {
    const hit = actual.find(a => a.kind === exp.kind && (!exp.surface || a.surface === exp.surface));
    if (hit) matched.push(exp);
  }
  const matchedKinds = new Set(matched.map(m => m.kind));

  // Required kinds that didn't match
  const missing = failOnMissing.filter(k => !matchedKinds.has(k));

  // Extras: actual findings whose kind is not in expected_findings
  const expectedKinds = new Set(expected.expected_findings.map(f => f.kind));
  const extras = actual.filter(a => !expectedKinds.has(a.kind));

  let passed = missing.length === 0;
  if (!allowExtras && extras.length > 0) passed = false;

  return { passed, matched, missing, extras };
}
