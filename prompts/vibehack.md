---
description: Start a new vibehack engagement against the given target
model: claude-haiku-4-5, claude-sonnet-4-6
thinking: minimal
skill: planner-recipes
restore: true
---

You are starting a new engagement against target: $@

Authorized testing only. The operator has confirmed scope. Proceed:

1. Call `vibehack_expand` with `parent_id: null`, `kind: "root"`, `claim: "engagement: $@"`, `falsifier: "n/a"`.
2. Then expand to top-level surfaces (web, subdomains, API, email, third-party). One `vibehack_expand` per surface, each with a sharp falsifier.
3. Pick the highest-confidence-gain surface and expand to a hypothesis with a concrete `next_test` and `falsifier`.
4. Stop after the first hypothesis. The operator will steer next.
