---
name: curl-recipes
description: HTTP probing recipes via curl. Use when pi-super-curl is not installed.
---

# curl recipes

## Headers + body
`curl -sS -i <url>`

## POST JSON
`curl -sS -X POST -H 'content-type: application/json' -d '{"k":"v"}' <url>`

## Save replay artifact
Always pipe to `tee evidence/<node_id>-<slug>.txt`.

## Auth
- Bearer: `-H "Authorization: Bearer $TOKEN"`
- Basic: `-u user:pass`
- Cookie: `-b 'k=v'`

## Common idioms for vibehack
- Tech detection: `curl -sI <url> | grep -iE '^(server|x-powered-by|via|set-cookie)'`
- Method discovery: `curl -sI -X OPTIONS <url>`
- Subdomain takeover hint: `curl -sI <subdomain> | grep -iE 'no-such-bucket|not found'`
