---
name: planner-recipes
description: Reasoning patterns for the pi-vibehack Planner — hypothesis framing, falsifier writing, tree pruning heuristics, recall query crafting.
---

# Planner Recipes

## Hypothesis framing

Good claim: "old-jboss.acme.example serves JBoss 6.1 with /jmx-console exposed without auth"
Bad claim: "JBoss might be vulnerable"

Good falsifier: "non-200 response on /jmx-console OR Server header does not match `JBoss-6.1`"
Bad falsifier: "vulnerability not present"

## Pruning heuristics

Prune when:
- A sibling node has reached `confirmed` and renders this branch redundant
- The falsifier triggered on the test
- The branch is out of scope (operator pinned)
- Depth ≥ 6 and confidence < 0.3 → prune; else confirm or dead-end

## Recall query crafting

Pull recall when expanding a node about a specific tech stack: query the `claim` field verbatim. The wire layer auto-injects, but explicit calls return more depth.
