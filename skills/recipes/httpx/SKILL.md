---
name: httpx
description: HTTP probing at scale via projectdiscovery/httpx.
---

# httpx recipes

## Tech detection + status
`httpx -title -tech-detect -status-code -l subdomains.txt`

## TLS info
`httpx -tls-grab -l hosts.txt`

## Filter by status
`httpx -mc 200,401,403`

## vibehack pattern
Pipe `subfinder -d <target> | httpx -title -tech-detect` for one-shot subdomain enum.
