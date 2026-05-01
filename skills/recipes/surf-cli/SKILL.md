---
name: surf-cli-recipes
description: Chrome control via nicobailon/surf-cli. Loaded when surf-cli is detected.
---

# surf-cli recipes

## Navigate
`surf goto <url>`

## Screenshot
`surf screenshot --out evidence/<node_id>-screen.png`

## Click + read
`surf click 'button:has-text("Login")'`
`surf read 'div.error'`

## Form fill
`surf fill '#username' admin --then fill '#password' admin --then click 'button[type=submit]'`

## vibehack pattern
Use only when `requires_browser: true` on the node. Record the action sequence to `poc/<node_id>/browser.jsonl` (`surf record start ... surf record stop`).
