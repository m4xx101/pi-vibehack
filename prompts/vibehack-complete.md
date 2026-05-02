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

Before returning, run Layer B reflection so confirmed leaves are distilled into
refined recipes under `~/.pi/agent/vibehack/skills/learned/`:

```bash
node "$(npm root -g)/@m4xx101/vibeshack/bin/vibehack-reflect.js"
```

This is best-effort — if it fails (e.g. no active engagement marker), continue
to report generation. Reflection NEVER writes to shipped recipes/specialists.

Return JSON: {"report_path": "report.md", "finding_count": N, "total_cost_usd": X}
