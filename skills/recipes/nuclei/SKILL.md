---
name: nuclei-recipes
description: Template-driven vuln scanning via projectdiscovery/nuclei.
---

# nuclei recipes

## Targeted CVE check
`nuclei -u <url> -id CVE-2017-12149`

## Severity filter
`nuclei -u <url> -severity high,critical`

## Custom template
`nuclei -u <url> -t /path/to/custom.yaml`

## vibehack pattern
After confirming tech stack, run nuclei filtered by stack tag: `nuclei -u <url> -tags <tag> -severity medium,high,critical`.
Save raw output to `evidence/<node_id>-nuclei.txt`.
