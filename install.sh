#!/usr/bin/env bash
# pi-vibehack curl-pipe installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/m4xx101/pi-vibehack/main/install.sh | bash
#
# Or with flags:
#   curl -fsSL https://raw.githubusercontent.com/m4xx101/pi-vibehack/main/install.sh | bash -s -- --profile local
#
# Inspect this script before piping if your security posture requires it:
#   curl -fsSL https://raw.githubusercontent.com/m4xx101/pi-vibehack/main/install.sh | less

set -euo pipefail

NPM_PKG="@m4xx101/vibeshack"
PI_PKG="@mariozechner/pi-coding-agent"
REPO="https://github.com/m4xx101/pi-vibehack"

red()    { printf "\033[0;31m%s\033[0m\n" "$*"; }
green()  { printf "\033[0;32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[0;33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[0;34m%s\033[0m\n" "$*"; }

require() {
  command -v "$1" >/dev/null 2>&1 || {
    red "✗ required: $1 not found on PATH"
    echo "  install: $2"
    exit 1
  }
}

main() {
  blue "==> pi-vibehack installer"
  echo "  repo: $REPO"
  echo "  npm:  $NPM_PKG"
  echo

  require node "https://nodejs.org (Node 18+)"
  require npm "comes with Node"

  node_version=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt 18 ]; then
    red "✗ Node $node_version is too old; need 18+"
    exit 1
  fi
  green "✓ node $(node -v)"

  if command -v pi >/dev/null 2>&1; then
    green "✓ pi-mono already installed: $(pi --version 2>&1 | head -1 || echo 'detected')"
  else
    yellow "→ installing pi-mono ($PI_PKG)..."
    npm install -g "$PI_PKG"
    green "✓ pi-mono installed"
  fi

  yellow "→ installing pi-vibehack ($NPM_PKG)..."
  # Forward any caller-supplied flags (e.g., --profile, --planner, --local)
  npx -y "$NPM_PKG" install "$@"
  echo

  green "✓ pi-vibehack installed"
  echo
  blue "==> next steps"
  echo "  1. (optional) install soft companions for power-ups:"
  echo "       npm i -g pi-super-curl    # HTTP/auth surface"
  echo "       npm i -g surf-cli         # browser automation"
  echo "  2. boot pi:           pi"
  echo "  3. start engagement:  /vibehack <authorized-target>"
  echo "  4. watch the tree:    /vibehack-tree"
  echo
  yellow "⚠ AUTHORIZED TESTING ONLY. The operator is responsible for authorization."
  echo "  Do not use against systems you do not own or have explicit, written permission to test."
}

main "$@"
