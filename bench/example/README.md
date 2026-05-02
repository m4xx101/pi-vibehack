# bench/example

Canonical bench template: a DVWA (Damn Vulnerable Web Application) instance booted via Docker.

## Run

```bash
./up.sh
# (in another shell, run /vibehack-evolve --bench example from pi)
./down.sh
```

## What this bench expects

`expected-findings.yaml` declares 2 findings the harness should confirm:

1. **SQLi at `/vulnerabilities/sqli/`** (high severity) — REQUIRED. Listed in `fail_on_missing`. If the harness doesn't confirm this, the bench fails.
2. **Directory listing at `/`** (low severity) — nice-to-have. Missing this does not fail the bench.

Extras beyond these two are allowed (`allow_extras: true`) — DVWA has many vulns; the harness is welcome to find more.

## Requirements

- Docker running locally
- Port 18080 free
- 60-second ready-poll budget (target boots fast)

## Copy this template

```bash
cp -r bench/example bench/<your-target>
# Edit up.sh, down.sh, expected-findings.yaml, this README
```
