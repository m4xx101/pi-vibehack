#!/usr/bin/env bash
docker stop vh-bench-example 2>/dev/null || true
# rm not needed since up.sh used --rm
