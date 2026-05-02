# Quickstart

Five minutes from zero to a first hypothesis-tree engagement.

> **Authorized testing only.** Do not run pi-vibehack against any system you do not own or have explicit, written permission to test. The targets used in this guide (`juice-shop.local`, `dvwa.local`) are deliberately-vulnerable training apps you run yourself. See [SECURITY.md](SECURITY.md).

---

## 1. Install pi-mono

pi-vibehack is a pi extension. You need pi installed first.

```bash
npm i -g @mariozechner/pi-coding-agent
pi --version    # confirm
```

If you don't have an Anthropic API key (or whichever provider you use) configured for pi, set it now per the [pi-mono README](https://github.com/badlogic/pi-mono#configuration). For local-only, see [INSTALL.md §Local-model setup](INSTALL.md#local-model-setup).

---

## 2. Install pi-vibehack

```bash
npx -y @m4xx101/pi-vibehack install
```

This:

- Verifies pi is on PATH (exits with a hint if not).
- Adds `npm:@m4xx101/pi-vibehack@<pinned>` to `~/.pi/agent/settings.json` (idempotent).
- Adds the two hard deps (`pi-prompt-template-model`, `@zenobius/pi-dcp`).
- Creates `~/.pi/agent/vibehack/` skeleton (lessons.jsonl, AGENTS.md, graph/, tools/, specialists/learned/).
- Writes `.profile` with the model triplet for the chosen profile (default `hybrid`).
- Rewrites prompt frontmatter to pin the resolved models (per-role overrides honored).
- Prints the authorized-testing-only disclaimer.

Restart pi or `/reload`.

---

## 3. (Optional) Install soft companions

Each one unlocks more of the harness. The harness works without them.

```bash
# graphify — unlocks the wire-layer <recall> auto-injection (the 10× move)
npm i -g graphify

# pi-super-curl — unlocks /scurl auth-wall round-trip + 3 ship templates
npm i -g pi-super-curl

# surf-cli — unlocks browser-required leaves
npm i -g surf-cli
```

vibehack auto-detects each at `session_start` and prints a banner. If a companion is absent, vibehack soft-degrades:

| Soft dep | Absent behavior |
|---|---|
| `graphify` | `before_provider_request` falls back to grep-over-events.jsonl. Banner: `💡 install graphify for cross-engagement <recall>`. |
| `pi-super-curl` | `curl.md` recipe loads instead of `super-curl.md`. `blocked-on-auth` flow still works but without `sendToAgent`. |
| `surf-cli` | `playwright-cli.md` recipe loads as fallback for `requires_browser` leaves. |

See [INSTALL.md §Soft companions](INSTALL.md#soft-companions) for full details.

---

## 4. Boot pi

```bash
pi
```

You should see a banner like:

```
🌳 pi-vibehack ready · no engagement
💡 install graphify for cross-engagement <recall>     ← only if missing
```

If you don't see the banner, the extension didn't load — see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#install-issues).

---

## 5. Start an engagement

Stand up a target you own. The OWASP [Juice Shop](https://github.com/juice-shop/juice-shop) container is a great first run:

```bash
docker run -d --rm -p 3000:3000 bkimminich/juice-shop
```

Then in pi:

```
/vibehack juice-shop.local
```

What happens at T+0:

- An engagement directory is created at `~/.pi/agent/vibehack/engagements/2026-05-02-juice-shop-local/`.
- A root node is added to `events.jsonl`. The Planner expands top-level surfaces (web / subdomains / API / email / third-party) — one `vibehack_expand` per surface, each with a falsifier.
- The Planner picks the highest-confidence-gain surface and emits *one* hypothesis with a `next_test` and `falsifier`.
- It stops. Awaiting your steer.

---

## 6. Walk through the first 5 turns

### Turn 1 — `/vibehack-tree`

Open the fullscreen viewer:

```
/vibehack-tree
```

You'll see something like:

```
🌳 engagement: juice-shop-local
  🌳 n_1 [surface] web — falsifier: "no HTTP service on :3000"
    🌳 n_2a [hypothesis] Juice Shop default admin/admin — falsifier: "401 on /rest/user/login with admin/admin"
  🌳 n_1b [surface] subdomains — falsifier: "no subdomains beyond apex"
  🌳 n_1c [surface] API — falsifier: "no JSON endpoints"
  🌳 n_1d [surface] email — falsifier: "no SPF/DKIM/DMARC mentions in headers"
  🌳 n_1e [surface] third-party — falsifier: "no third-party scripts in HTML"

Total cost: $0.0034
```

Press `q` to close. The viewer is read-only; nothing has been executed yet.

### Turn 2 — let the Planner proceed

Just send any input (or hit Enter) — the Planner is proactive. It will pick `n_2a`, expand a leaf with a concrete `next_test` like `POST /rest/user/login {"email":"admin@juice-sh.op","password":"admin"}`. No bash runs in the Planner; this is reasoning only.

### Turn 3 — `/confirm n_2a`

Spawn an Operator subprocess to actually test the leaf:

```
/confirm n_2a
```

The Operator (Opus 4.7 on `hybrid`) spawns as `pi --mode json -p --no-session`, reads the structured input contract (see [ARCHITECTURE.md §Subprocess contracts](ARCHITECTURE.md#three-roles-and-subprocess-contracts)), runs `curl` (or `super-curl` if installed), returns:

```json
{
  "node_id": "n_2a",
  "outcome": "falsified",
  "evidence": [{"kind":"http_response","ref":"poc/n_2a/probe.txt","summary":"401 Unauthorized"}],
  "confidence": 0.95,
  "suggested_next_steps": [{"claim":"register a test account","next_test":"POST /api/Users","falsifier":"non-201 response"}],
  "handoff_summary":"Default admin/admin failed. Try registration → token → privilege escalation.",
  "cost_tokens": 4821,
  "cost_usd": 0.04
}
```

The `tool_result` hook folds this into `events.jsonl`, runs negative-space synthesis on the response headers (Juice Shop is missing a CSP — synthetic evidence event added), and runs `graphify update` if installed. The Planner sees the falsified outcome on its next turn and pivots.

### Turn 4 — `/steer focus on registration → JWT tampering`

You see the Planner exploring a path you'd rather skip. Steer it:

```
/steer focus on registration → JWT tampering, deprioritize OAuth
```

The `/steer` command writes a `pending-steer.txt` and a `steer` event. On the *next* `before_agent_start`, the steer is injected as a `<steer>...</steer>` block into the system prompt — non-blocking, the Planner reprioritizes naturally. ([COMMANDS.md §/steer](COMMANDS.md#steer))

### Turn 5 — `/expand n_3b`

Force-expand a specific node when you have intuition the Planner missed:

```
/expand n_3b
```

Or `/prune n_3c out of scope` to hard-skip. These are escape hatches; in normal operation the Planner is the one expanding and pruning.

---

## 7. Wrap up

When you've found enough (or run out of leaf ideas):

```
/vibehack-complete
```

This spawns the *final* Reporter subprocess. It reads `events.jsonl`, `tree.md`, every `poc/<node_id>/poc.md`, and `AGENTS.md`, and writes:

```
~/.pi/agent/vibehack/engagements/2026-05-02-juice-shop-local/
├── events.jsonl
├── tree.md
├── findings.md
├── AGENTS.md
├── audit.log
├── report.md            ← the deliverable
└── poc/
    ├── n_2a/probe.txt
    ├── n_4b/poc.md      ← per-leaf reporter writeups
    ├── n_4b/replay.curl
    └── ...
```

`report.md` has the standard sections: exec summary, findings table, full PoCs with reproduction steps, remediation, IoC table, timeline, cost ledger.

### Optional: distill lessons

```
/vibehack-distill
```

Reads the last 3 engagements' events.jsonl, extracts recurring `(situation, action, outcome)` patterns, writes refined recipe SKILL.md files into `skills/learned/`. `/reload` to pick them up next session. The lessons compound across engagements.

---

## What to read next

- [OPERATOR-GUIDE.md](OPERATOR-GUIDE.md) — the daily-use manual; covers chains, auth walls, browser leaves, specialists, pinning, handoff.
- [COMMANDS.md](COMMANDS.md) — every slash command, its frontmatter, side effects, examples.
- [RECIPES.md](RECIPES.md) — what each bundled recipe / specialist does, when the planner pulls it in.
- [ARCHITECTURE.md](ARCHITECTURE.md) — the seven layers, the loop invariants, the 10× move in detail.
- [SECURITY.md](SECURITY.md) — read this **before** running against anything you didn't write yourself.
