---
name: operator-recipes
description: Execution discipline for the pi-vibehack Operator subprocess — evidence capture, replay artifact format, structured-output contract.
---

# Operator Recipes

## Evidence capture

- Save raw outputs to `engagements/<id>/evidence/<node_id>-<slug>.{txt,json,bin}`
- Reference by relative path in the structured output: `"ref": "evidence/n_3a-jmx.txt"`

## Replay artifact format

For HTTP findings, write both:
- `replay.curl` — single-line curl one-liner
- `replay.scurl.json` (if pi-super-curl present) — scurl template JSON

For shell findings: `replay.sh` with the exact command sequence and any required env vars at the top.

## Outcome decision tree

- `falsified` if the falsifier triggered exactly. No partial credit.
- `confirmed` only with replayable artifact + confidence ≥ 0.85.
- `inconclusive` when partial signal but no clean confirm; populate `suggested_next_steps`.
- `blocked-on-auth` when an auth wall blocks the test; fill `scurl_template_request`.

## structured_output discipline

Emit exactly one `structured_output(terminate=true, output=...)` call. Do not narrate around it.
