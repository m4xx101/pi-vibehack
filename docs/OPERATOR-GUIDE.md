# pi-vibehack — Operator Guide

## Starting an engagement

```
/vibehack acme.example
```

The Planner creates the root node and expands top-level surfaces. Watch the status banner:

```
🌳 5 nodes · 0 confirmed · $0.003 · /vibehack-tree
```

## The hypothesis tree

The Planner expands hypotheses with falsifiers. Every leaf has a `next_test` (what to do) and `falsifier` (what would prove the claim wrong).

You don't normally type tree commands — the Planner is proactive. But escape hatches exist:

```
/expand n_3a       # expand a specific node
/prune n_3b out of scope
/confirm n_4a      # spawn Operator to test a leaf
/steer focus on the GraphQL endpoint
```

## Auth walls

When an Operator subprocess hits an auth wall, it returns `outcome: "blocked-on-auth"`. The Planner fires `/scurl <template>` (if pi-super-curl is installed). You paste the captured value into the scurl TUI; the subprocess respawns with the new auth profile.

## Browser-required leaves

Mark a hypothesis `requires_browser: true` when it depends on JS execution / SPA / OAuth flow. Operator subprocess auto-loads `surf-cli` (or `playwright-cli` fallback) recipes.

## Chains

The Planner may propose an exploit chain. You'll see:

```
🌳 ... · ⚠ chain proposed: n_3b → n_4a → n_5c — /vibehack-chain-confirm or /vibehack-chain-reject
```

```
/vibehack-chain-confirm                # run sequentially
/vibehack-chain-confirm --interactive  # halt between steps
/vibehack-chain-reject too noisy       # prune
```

## Pinning facts

```
/vibehack-pin out-of-scope: *.staging.target.com
/vibehack-pin --global  prefer Tor for OSINT
```

These are hand-curated context, loaded at every `before_agent_start`.

## Tool-extending on the fly

```
/vibehack-ingest ffuf                                    # CLI on PATH
/vibehack-ingest https://github.com/projectdiscovery/subfinder  # repo
/vibehack-ingest "wayback URL collector that paginates"  # synthesize
/vibehack-ingest --inline "I need a tool that..."        # operator-authored brief
/vibehack-ingest --specialist phishing                   # new specialist skill
```

After ingest: `/reload` to pick up new skills.

## Wrapping up

```
/vibehack-pause            # checkpoint, halt
/vibehack-resume           # resume latest
/vibehack-complete         # final report + close engagement
/vibehack-distill          # extract patterns into skills/learned/
```

## Authorized testing only

The harness has unleashed scope by design. **You** are responsible for authorization. The audit.log is your forensic record.
