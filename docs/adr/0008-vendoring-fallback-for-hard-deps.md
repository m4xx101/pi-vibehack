# ADR 0008 — Vendor-fork procedure for hard deps

## Status
Accepted.

## Context
We hard-depend on `pi-prompt-template-model` and `pi-dcp`. Both are small (~500 LoC each) but third-party.

## Decision
If either upstream goes silent for > 90 days with breaking pi-mono changes pending: fork into `vendor/<pkg>/` inside this repo, switch the peer-dep to a path import in `package.json`, and credit the original author in the fork README.

## Consequences
- Time-bounded vendor risk.
- Operators see no behavior change.
- We commit to maintaining the fork until upstream returns or a replacement emerges.
