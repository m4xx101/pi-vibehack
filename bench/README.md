# bench/

Layer A evaluation harness. Each `bench/<name>/` is a self-contained target+oracle that `/vibehack-evolve --bench <name>` can run against.

## Per-bench contract

Every `bench/<name>/` MUST contain exactly these 4 files:

| File | Purpose |
|---|---|
| `up.sh`   | Boot the target. Must exit 0 within 60 seconds when target is ready. Print `ready` to stdout on success. |
| `down.sh` | Tear down. Must always succeed (idempotent). |
| `expected-findings.yaml` | Declarative oracle (see schema below). |
| `README.md` | What this bench targets, how to use it. |

## `expected-findings.yaml` schema

```yaml
target: <URL or host:port>
class: web-app | network | binary | mobile | api
expected_findings:
  - phase: enum | exploit | post-exploit
    kind: <vulnerability class string, e.g. SQLi>
    surface: <URL path or asset reference>
    severity: low | medium | high | critical
    canary_token: "{{generate}}"  # optional, Phase 12+
allow_extras: true | false   # default true
fail_on_missing:             # list of `kind` values that MUST appear; missing fails the bench
  - SQLi
  - RCE
```

## Running

```
/vibehack-evolve --bench <name>           # report only
/vibehack-evolve --bench <name> --mutate  # try to fix harness on failure (Phase 8+)
```

## Results

After each run, `bench/<name>/results/<timestamp>.md` records pass/fail + matched/missing/extras.
