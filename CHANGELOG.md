# Changelog

## [1.0.0] — TBD

### Added
- Hypothesis-tree REPL with eight Planner mutation tools.
- Three-role subprocess isolation (Planner / Operator / Reporter).
- Six lifecycle hooks (`session_start`, `before_agent_start`, `tool_call`, `tool_result`, `before_provider_request`, `session_before_compact`).
- Four pi-dcp rules for working-context budget.
- graphify-backed `vibehack_recall` + wire-layer `<recall>` auto-injection.
- Negative-space synthesis (missing CSP/HSTS/SameSite/etc + filtered-port detection).
- Auto-handoff at subprocess boundaries.
- Nine recipe skills (curl/super-curl/httpx/nuclei/ffuf/searchsploit/nmap/surf-cli/playwright-cli).
- Five specialist skills (web-recon, web-exploit, binary-recon, auth-bypass, osint).
- 17 frontmatter slash commands (15 core + 2 soft-companion).
- Tool-ingest in four modes (CLI / repo / synthesis / inline).
- Operator-gated chain mode (`/vibehack-chain-confirm`).
- Three pi-super-curl templates (auth-bearer-probe, jwt-tamper, csrf-replay).
- Browser automation via surf-cli + playwright-cli fallback.
- pi-prompt-template-model dispatch (per-command model + thinking + skill).
- Three install profiles (hybrid, local, frontier) + per-role overrides.
- Cross-session memory: `lessons.jsonl` + global graphify graph.
