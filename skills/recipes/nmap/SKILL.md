---
name: nmap
description: Port + service scanning via nmap.
---

# nmap recipes

## Top 1000 + service detection
`nmap -sV -T4 --top-ports 1000 <target>`

## All ports (slow but thorough)
`nmap -p- -T3 <target>`

## Script scan for known issues
`nmap --script vuln <target>`

## vibehack pattern
Always start with `-sV --top-ports 1000`. Pipe output to `evidence/<node_id>-nmap.txt`. The negative-space hook auto-detects filtered common ports.
