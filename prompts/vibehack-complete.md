---
description: Close the engagement; spawn the final reporter
model: claude-opus-4-7
thinking: high
skill: reporter-recipes
subagent: vibehack-reporter
inheritContext: false
restore: true
---

Final reporter for the active engagement. Read events.jsonl, tree.md, every poc/<node_id>/poc.md, AGENTS.md. Write engagements/<id>/report.md with: exec summary, findings table, full PoCs, reproduction steps, remediation, IoCs, timeline, cost ledger.

Return JSON: {"report_path": "report.md", "finding_count": N, "total_cost_usd": X}
