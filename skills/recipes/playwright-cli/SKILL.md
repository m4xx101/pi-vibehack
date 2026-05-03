---
name: playwright-cli
description: Browser automation via Playwright CLI. Used when surf-cli is unavailable.
---

# playwright-cli recipes

## Run a script
`npx playwright test <script.spec.ts>`

## Codegen (record actions)
`npx playwright codegen <url>` — produces a script you can save to `evidence/<node_id>-playwright.ts`.

## Headless screenshot
`npx playwright screenshot <url> evidence/<node_id>-screen.png`

## vibehack pattern
Generate a minimal `playwright.spec.ts` that performs the exact action chain and saves screenshots between steps. Save the spec + screenshots under `poc/<node_id>/`.
