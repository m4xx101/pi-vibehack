---
name: searchsploit
description: Local CVE/exploit lookup via exploit-db's searchsploit.
---

# searchsploit recipes

## Lookup
`searchsploit JBoss 6.1`
`searchsploit "Apache Tomcat 9"`

## Mirror exploit code
`searchsploit -m <id>` copies the .c/.py/.rb file to cwd.

## Filter by type
`searchsploit -t webapps "drupal 8"`

## vibehack pattern
After version-fingerprinting a service, run searchsploit for that exact version. Reference the resulting EDB-ID in evidence; cite to Reporter.
