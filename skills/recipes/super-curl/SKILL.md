---
name: super-curl-recipes
description: HTTP/auth recipes via pi-super-curl /scurl. Auto-loaded when pi-super-curl is detected.
---

# super-curl recipes

## /scurl
Opens the request builder TUI. Templates pre-filled by vibehack:
- `auth-bearer-probe` — test bearer scope
- `jwt-tamper` — modify JWT alg/payload, replay
- `csrf-replay` — capture CSRF token, replay with rotated value

## Auth profiles (`.pi-super-curl/config.json`)
Set once per scope; vibehack mirrors auth state changes from Operator outputs into this file automatically.

## Replay artifact
Use `/scurl-history` to find the exact request. Save the JSON template to `evidence/<node_id>.scurl.json`.

## Live HITL auth
When the Operator returns `outcome: "blocked-on-auth"`, the Planner fires `/scurl <template>`. Operator pastes the captured value into the field marked `sendToAgent: true`. Subprocess respawns with the new auth profile.

## JWT tampering pattern
1. Decode current JWT
2. Set `alg` to `none`, drop signature
3. Modify payload (e.g., `role: admin`)
4. Replay; expected falsifier: 401 or 403
