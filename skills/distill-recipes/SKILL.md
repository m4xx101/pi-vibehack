---
name: distill-recipes
description: Pattern extraction for the /vibehack-distill command — situation/action/outcome triples, recipe synthesis.
---

# Distill Recipes

## Triple extraction

For each confirmed leaf across the last N engagements:
- **situation:** stack signature (e.g., "JBoss 6.1 + /jmx-console exposed")
- **action:** the test that confirmed it (`next_test` field)
- **outcome:** the evidence kind + summary

Cluster triples by stack signature with cosine similarity ≥ 0.8 (or string-equality fallback).

## Recipe synthesis

For each cluster of ≥ 2 triples:
1. Generate `skills/learned/<slug>/SKILL.md` with frontmatter `description` summarizing the recurring pattern.
2. Body: bullet list of variations + canonical replay snippet.
3. If the cluster cardinality crosses 5, mark `priority: high` in frontmatter.
