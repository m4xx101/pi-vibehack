---
name: ffuf
description: Fuzzing endpoints, params, and vhosts via ffuf.
---

# ffuf recipes

## Path discovery
`ffuf -u https://target/FUZZ -w /usr/share/wordlists/dirb/common.txt -mc 200,301,302,401,403`

## Param fuzzing
`ffuf -u 'https://target/api/x?FUZZ=test' -w params.txt -fs <baseline-size>`

## Vhost
`ffuf -u https://target/ -H 'Host: FUZZ.target' -w vhosts.txt -fs <baseline>`

## vibehack pattern
Always set `-fs` (filter size) to baseline 404 size after a manual probe. Save to `evidence/<node_id>-ffuf.txt`.
