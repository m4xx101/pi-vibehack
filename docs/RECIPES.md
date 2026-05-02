# pi-vibehack — Recipes & Specialists Reference

What ships in the box. For the source of truth, read each `SKILL.md` directly under `skills/`.

## Recipe loading

When the Planner spawns an Operator subprocess, the input contract carries a `recipe_hints` array. Pi auto-discovers skills under `skills/recipes/` and `skills/specialists/`. The Operator's system prompt loads the matching SKILL.md content.

Two swap pairs:

- **`curl` ↔ `super-curl`** — auto-detection at `session_start`. If `pi-super-curl` is installed, recipe `super-curl` is preferred. Otherwise `curl`.
- **`surf-cli` ↔ `playwright-cli`** — when a leaf is marked `requires_browser: true`, the `browser-bridge` lib detects which is available and adds the corresponding recipe hint.

## Bundled recipe skills (9)

### HTTP family

#### `curl-recipes` — [`skills/recipes/curl/SKILL.md`](../skills/recipes/curl/SKILL.md)

Minimal HTTP probing via curl. Used when `pi-super-curl` is absent. Covers headers + body, JSON POST, replay-artifact saving, auth (Bearer/Basic/Cookie), tech detection, method discovery, subdomain takeover hints.

#### `super-curl-recipes` — [`skills/recipes/super-curl/SKILL.md`](../skills/recipes/super-curl/SKILL.md)

HTTP/auth recipes via [`pi-super-curl`](https://github.com/Graffioh/pi-super-curl). The advanced surface. Auto-loaded when scurl is detected. Covers `/scurl` request builder, auth profiles via `.pi-super-curl/config.json`, `/scurl-history` for replay, the **`sendToAgent` mechanism** for live human-in-the-loop auth, JWT tampering pattern.

The `sendToAgent` mechanism is the auth-round-trip glitch. When the Operator returns `outcome: "blocked-on-auth"`, the Planner fires `/scurl <template>` with a field marked `sendToAgent: true`. The operator pastes the captured value (CSRF token, MFA code, fresh JWT) into the scurl TUI; the value flows back into the agent context; the Operator subprocess respawns with the new auth profile.

#### `httpx-recipes` — [`skills/recipes/httpx/SKILL.md`](../skills/recipes/httpx/SKILL.md)

HTTP probing at scale via [projectdiscovery/httpx](https://github.com/projectdiscovery/httpx). Tech detection + status, TLS info, status filtering, the `subfinder | httpx` one-shot subdomain enum pattern.

### Scanning family

#### `nuclei-recipes` — [`skills/recipes/nuclei/SKILL.md`](../skills/recipes/nuclei/SKILL.md)

Template-driven vuln scanning via [projectdiscovery/nuclei](https://github.com/projectdiscovery/nuclei). Targeted CVE checks, severity filtering, custom templates, the "tag-filtered after fingerprint" pattern.

#### `ffuf-recipes` — [`skills/recipes/ffuf/SKILL.md`](../skills/recipes/ffuf/SKILL.md)

Fuzzing endpoints, params, vhosts via ffuf. Path discovery, param fuzzing with `-fs` baseline filter, vhost fuzzing.

#### `searchsploit-recipes` — [`skills/recipes/searchsploit/SKILL.md`](../skills/recipes/searchsploit/SKILL.md)

Local CVE/exploit lookup via exploit-db's searchsploit. Version-targeted lookup, mirroring exploit code, type filtering.

#### `nmap-recipes` — [`skills/recipes/nmap/SKILL.md`](../skills/recipes/nmap/SKILL.md)

Port + service scanning via nmap. Top 1000 + service detection, full port scan, vuln script. The negative-space hook auto-flags filtered common ports.

### Browser family

#### `surf-cli-recipes` — [`skills/recipes/surf-cli/SKILL.md`](../skills/recipes/surf-cli/SKILL.md)

Chrome control via [`surf-cli`](https://github.com/nicobailon/surf-cli). Navigate, screenshot, click + read, form fill, action recording to `poc/<node_id>/browser.jsonl`. Loaded only on `requires_browser: true` leaves.

#### `playwright-cli-recipes` — [`skills/recipes/playwright-cli/SKILL.md`](../skills/recipes/playwright-cli/SKILL.md)

Browser automation via Playwright CLI. Used when surf-cli is unavailable. Codegen, headless screenshot, spec generation.

## Role-recipe skills (5)

These teach the *role* (Planner/Operator/Reporter) how to behave. Loaded by the corresponding subprocess.

#### `planner-recipes` — [`skills/planner-recipes/SKILL.md`](../skills/planner-recipes/SKILL.md)

Reasoning patterns for the Planner. Hypothesis framing (good vs bad claims), pruning heuristics (when to prune vs confirm vs dead-end), recall-query crafting tips.

#### `operator-recipes` — [`skills/operator-recipes/SKILL.md`](../skills/operator-recipes/SKILL.md)

Execution discipline for Operator subprocesses. Evidence-capture conventions (`evidence/<node_id>-<slug>.{txt,json,bin}`), replay-artifact format (curl one-liner + scurl JSON), outcome decision tree (when to return confirmed/falsified/inconclusive/blocked-on-auth), structured-output discipline (`terminate=true`).

#### `reporter-recipes` — [`skills/reporter-recipes/SKILL.md`](../skills/reporter-recipes/SKILL.md)

Writeup style for the Reporter. Per-leaf PoC format, final report structure (8 required sections: exec summary, findings table, detailed findings, reproduction steps, remediation, IoCs, timeline, cost ledger).

#### `distill-recipes` — [`skills/distill-recipes/SKILL.md`](../skills/distill-recipes/SKILL.md)

Pattern extraction for `/vibehack-distill`. (situation, action, outcome) triples, clustering by stack signature, recipe synthesis from clusters with cardinality ≥ 2.

#### `ingest-recipes` — [`skills/ingest-recipes/SKILL.md`](../skills/ingest-recipes/SKILL.md)

Tool-ingest discipline for `/vibehack-ingest`. The 4 modes (CLI / repo / synthesis / inline), validation gate, the standard recipe-template that ingest must produce.

## Specialist skills (5)

These pin a *specialization* onto an Operator subprocess. Spawned via `vibehack_propose_specialist(node_id, kind)`. Loaded via `loadSpecialist(kind)`: shipped first, then `specialists/learned/<kind>/`.

#### `web-recon-specialist` — [`skills/specialists/web-recon/SKILL.md`](../skills/specialists/web-recon/SKILL.md)

Web reconnaissance. Discipline: passive first (subfinder, amass passive, crt.sh), then httpx, then nmap on confirmed live hosts. Confirmed = exhaustive subdomain set + tech-fingerprinted with confidence ≥ 0.8. Falsifier tells: DNS wildcard (poison), CDN-fronted (mark inconclusive, pivot to OSINT).

#### `web-exploit-specialist` — [`skills/specialists/web-exploit/SKILL.md`](../skills/specialists/web-exploit/SKILL.md)

Web exploitation. Discipline: one technique per run, probe non-destructively first, escalate only on confirmed surface. Common techniques: deserialization (ysoserial / pickle), SSRF (gopher, file, AWS metadata), path traversal, auth bypass (alg=none JWT, kid path-traversal, default creds).

#### `binary-recon-specialist` — [`skills/specialists/binary-recon/SKILL.md`](../skills/specialists/binary-recon/SKILL.md)

Binary / CTF reverse engineering. `file` first, `checksec`, `strings -n 8 | grep`, `objdump -d` on main + user-input functions. For Windows: rabin2 / radare2 imports. Falsifier tells: stripped + no symbols → confidence cap 0.7; heavy obfuscation → pivot to dynamic.

#### `auth-bypass-specialist` — [`skills/specialists/auth-bypass/SKILL.md`](../skills/specialists/auth-bypass/SKILL.md)

Authentication bypass. Capture auth flow, identify primitive (cookie/JWT/SAML/OAuth/API-key/Basic), test obvious first (default creds, alg=none, missing CSRF), then targeted (scope-leak, session-fixation, token-reuse-across-tenant). Auth state changes set `auth_state_changes.profile_id` for `tool_result` hook to mirror into scurl.

#### `osint-specialist` — [`skills/specialists/osint/SKILL.md`](../skills/specialists/osint/SKILL.md)

Open-source intelligence. Sources: crt.sh, Wayback Machine, GitHub code search, Shodan/Censys (if API key), LinkedIn (manual). Discipline: save raw to `evidence/<node_id>-osint-<source>.json`, cite source URL. Falsifier tells: no historical certs → small org / new domain (cap confidence 0.6); empty Wayback → low public attack surface, pivot to direct probing.

## scurl templates (3)

Bundled in `templates/scurl/`. When pi-super-curl is detected, vibehack registers them via scurl's config so the Planner can invoke `/scurl <template>` programmatically.

#### `auth-bearer-probe` — [`templates/scurl/auth-bearer-probe.json`](../templates/scurl/auth-bearer-probe.json)

GET `{{env.TARGET_URL}}` with `Authorization: Bearer {{env.BEARER}}`. Single input `BEARER` marked `sendToAgent: true`. Use: probe whether a bearer token has a given scope.

#### `jwt-tamper` — [`templates/scurl/jwt-tamper.json`](../templates/scurl/jwt-tamper.json)

GET with `Authorization: Bearer {{jwt.tampered}}`. Inputs: `ORIGINAL_JWT`, `MODE` (`alg-none | kid-traversal | role-elevate`). Preprocesses via `scripts/jwt-tamper.js`. Use: classic JWT attacks.

#### `csrf-replay` — [`templates/scurl/csrf-replay.json`](../templates/scurl/csrf-replay.json)

POST form body with `csrf_token` + session cookie. Inputs: `csrf_token` (sendToAgent: true), `SESSION`. Use: replay CSRF-protected POST after capturing the token from the browser.

## How recipes get loaded — concrete walkthrough

```
Planner emits: vibehack_expand({
  node_id: "n_2a", kind: "leaf", phase: "exploit",
  claim: "old-jboss.acme.example RCE via CVE-2017-12149",
  next_test: "POST deserialization payload to /jmx-console",
  falsifier: "non-200 or missing JMXInvokerServlet",
  recipe_hints: ["super-curl", "searchsploit"],
  specialist_skill: "web-exploit"
})
       ▼
Operator splash. spawnOperator builds:
  systemPrompt =
    skills/specialists/web-exploit/SKILL.md   (specialist body)
    + "\n\n---\n\n"
    + subagents/vibehack-operator.md           (role)
       ▼
pi --append-system-prompt /tmp/.../system.md
       ▼
Operator agent starts. Pi's auto-discovery loads SKILL.md frontmatter
   for every skill directory under skills/. Operator can `read` any
   recipe SKILL.md content directly when it needs depth on a recipe
   the input contract referenced via recipe_hints.
       ▼
Operator runs: bash searchsploit JBoss 6.1
                bash curl -sS ...   (or scurl if available)
       ▼
Operator returns structured JSON.
```

## Adding your own recipes & specialists

See [`EXTENDING.md`](EXTENDING.md).
