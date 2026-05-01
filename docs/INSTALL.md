# Install

## Prerequisites

- Node.js ≥ 18
- [pi-mono](https://github.com/badlogic/pi-mono) (`pi --version`)
- (Recommended) [graphify](https://github.com/...) — enables cross-engagement recall
- (Recommended) [pi-super-curl](https://github.com/Graffioh/pi-super-curl) — auth + HTTP power-ups
- (Recommended) [surf-cli](https://github.com/nicobailon/surf-cli) — browser automation

## Quick install

```bash
npx -y @m4xx101/pi-vibehack install
```

This:
1. Patches `~/.pi/agent/settings.json` to pull `pi-vibehack`, `pi-prompt-template-model`, and `pi-dcp`.
2. Creates `~/.pi/agent/vibehack/` skeleton.
3. Writes `~/.pi/agent/vibehack/.profile`.

Then restart pi or run `/reload`.

## Profiles

```bash
npx -y @m4xx101/pi-vibehack install --profile hybrid     # default
npx -y @m4xx101/pi-vibehack install --profile local      # all-local models
npx -y @m4xx101/pi-vibehack install --profile frontier   # all-frontier
```

Per-role overrides:

```bash
npx -y @m4xx101/pi-vibehack install --profile hybrid \
  --planner claude-haiku-4-5 \
  --operator claude-opus-4-7 \
  --reporter claude-opus-4-7
```

## Project-scoped install

```bash
npx -y @m4xx101/pi-vibehack install --local
```

Patches `.pi/settings.json` instead of the global one. Engagement data still goes to `~/.pi/agent/vibehack/`.

## Uninstall

```bash
npx -y @m4xx101/pi-vibehack uninstall
```

Removes the settings.json line. Engagement data (`~/.pi/agent/vibehack/`) is preserved — remove manually if desired.

## Update

In a pi session:

```
/vibehack-update
```

Or rerun the install command.

## Troubleshooting

- **`pi: command not found`** — install pi-mono first: `npm i -g @mariozechner/pi-coding-agent`.
- **Hard dep missing** — `npm i -g @nicobailon/pi-prompt-template-model pi-dcp`.
- **No `<recall>` injections** — install graphify, or accept the grep-fallback (still works).
- **scurl integration silent** — `npm i -g pi-super-curl` then `/reload`.
