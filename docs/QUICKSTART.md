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

If you don't have an Anthropic API key (or whichever provider you use) configured for pi, set it now per the [pi-mono README](https://github.com/badlogic/pi-mono#configuration).

---

## 2. Install pi-vibehack

```bash
curl -fsSL https://raw.githubusercontent.com/m4xx101/pi-vibehack/main/install.sh | bash
```

Or via npm:
```bash
npm i -g @m4xx101/vibeshack
pi-vibehack install
```

After it finishes, restart pi (`/reload` or just relaunch).

---

## 3. Spin up a target (Juice Shop)

If you don't already have a vulnerable training target, OWASP Juice Shop is a one-liner:

```bash
docker run --rm -p 3000:3000 bkimminich/juice-shop
# http://localhost:3000
```

---

## 4. Open pi and start the engagement

```bash
pi
```

In pi:

```text
/vibehack juice-shop.local

✓ engagement started: 2026-05-06-juice-shop-local (target: juice-shop.local)
```

Now just type a directive in natural language:

```text
> Enumerate the public surface and look for IDOR or SQLi candidates on the
  REST API. Use httpx and nuclei. We don't have credentials yet.
```

The planner does the rest. It will:
1. Call `vibehack_expand` to seed root + initial hypotheses.
2. Call `vibehack_tool_search({query:"http probe"})` and `vibehack_load_tools` to expose `vibehack_run_httpx` + `vibehack_run_nuclei`.
3. Run them via the wrappers, emit `vibehack_evidence` rows.
4. Confirm or dead-end leaves as data comes in.

---

## 5. Watch the tree grow

```text
/vibehack-tree

n_root  ▸ juice-shop.local
├─ n_1a [confirmed] /api/Users/ exposes role field via prototype-pollution-style query
├─ n_1b [open]      /rest/products/search ?q= reflective; testing for SQLi
│  └─ n_1b_1a [in-flight] sleep-based blind via UNION
└─ n_1c [dead]      /api/Quantitys/ — auth required, no leverage
```

---

## 6. Hand the wheel over (autonomous mode)

For a focused 10-turn run:

```text
/vibehack-auto 10
```

This fires `pi.sendUserMessage(...,{deliverAs:"followUp"})` per turn until budget exhausted, all open nodes resolved, or you run `/vibehack-auto stop`. Watch the cost banner.

---

## 7. Wrap up

```text
/vibehack-complete

✓ findings.md at ~/.pi/agent/vibehack/engagements/2026-05-06-juice-shop-local/findings.md
✓ canaries cleaned up
✓ graphify graph refreshed
```

Open the report:

```bash
cat ~/.pi/agent/vibehack/engagements/2026-05-06-juice-shop-local/findings.md
```

---

## What just happened (in one paragraph)

You started an engagement. The planner mutated a hypothesis tree under invariants enforced by hooks (every leaf must have a falsifier; depth ≤ 6; breadth ≤ 8). When it needed external tools, it dynamically loaded wrappers via `vibehack_load_tools` so its context budget stayed lean. When it confirmed a finding, the operator subprocess (a separate `pi --mode json -p --no-session`) executed the exploit, returned schema-validated JSON, never leaked target output back into the planner's reasoning chain. Every event landed in `events.jsonl` and was mirrored to pi's session JSONL via `pi.appendEntry`. On `/vibehack-complete`, the confirmed leaves were indexed into a graphify graph so the next engagement starts smarter than this one finished.

---

## Where to go next

- **[OPERATOR-GUIDE.md](OPERATOR-GUIDE.md)** — daily-use manual: when to expand, when to prune, auth walls, chains, specialists.
- **[COMMANDS.md](COMMANDS.md)** — every slash command and Planner tool with examples.
- **[RECIPES.md](RECIPES.md)** — bundled recipes (curl, super-curl, ffuf, nuclei, …).
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — the deep dive: 7 layers, event taxonomy, six-memory model.
