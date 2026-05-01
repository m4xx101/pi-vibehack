---
description: Confirm a leaf vulnerable; spawn per-leaf reporter
model: claude-opus-4-7
thinking: high
skill: operator-recipes
subagent: vibehack-operator
inheritContext: false
restore: true
---

Confirm leaf $1. Execute the leaf's `next_test`. If confirmed, return structured output with `outcome: "confirmed"`, evidence refs, and a `handoff_summary`. Per-leaf reporter will be spawned automatically.
