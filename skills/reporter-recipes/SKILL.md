---
name: reporter-recipes
description: Writeup style for the pi-vibehack Reporter subprocess — per-leaf PoC format, final report structure, remediation phrasing.
---

# Reporter Recipes

## Per-leaf PoC

```markdown
# Finding: <claim>

**Severity:** <Low|Medium|High|Critical>
**Confidence:** 0.92
**Status:** Confirmed

## Summary
One paragraph: what's vulnerable, why, impact.

## Reproduction
1. Step 1
2. Step 2

```bash
# replay.curl content here
```

## Evidence
- evidence/<file>: <summary>

## Remediation
- Concrete fix
- Defense-in-depth additions
```

## Final report structure

1. Executive summary (1 paragraph)
2. Findings table (severity / node_id / claim / status)
3. Detailed findings (one section per confirmed leaf)
4. Reproduction steps (in order)
5. Remediation guidance (per finding)
6. IoCs table
7. Engagement timeline
8. Cost ledger
