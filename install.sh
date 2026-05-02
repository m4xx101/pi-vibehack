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

  # Helper: run a command, on failure detect the @stacksjs/clarity bunx git-hooks
  # postinstall signature, and retry once with --ignore-scripts if it matches.
  # Args: <log-label> <cmd> [args...]
  install_with_retry() {
    local label="$1"; shift
    local logfile="/tmp/pi-install.log"
    : > "$logfile"
    if "$@" 2> >(tee -a "$logfile" >&2); then
      return 0
    fi
    if grep -qE 'git-hooks|@stacksjs/clarity|postinstall' "$logfile"; then
      yellow "⚠ ${label} failed due to a known transitive postinstall (bunx git-hooks / @stacksjs/clarity)."
      yellow "  Retrying with --ignore-scripts (safe — only skips dev-time git-hooks setup, not runtime code)..."
      # Inject --ignore-scripts after the npm subcommand (install/exec/etc.).
      # For `npm install -g <pkg>` → `npm install -g --ignore-scripts <pkg>`.
      # For `npx -y <pkg> install ...` we instead set npm_config_ignore_scripts=true.
      if [ "$1" = "npm" ]; then
        local cmd=("$1" "$2")
        shift 2
        cmd+=(--ignore-scripts "$@")
        "${cmd[@]}"
      else
        npm_config_ignore_scripts=true "$@"
      fi
    else
      red "✗ ${label} failed (see $logfile)"
      return 1
    fi
  }

  if command -v pi >/dev/null 2>&1; then
    green "✓ pi-mono already installed: $(pi --version 2>&1 | head -1 || echo 'detected')"
  else
    yellow "→ installing pi-mono ($PI_PKG)..."
    install_with_retry "pi-mono install" npm install -g "$PI_PKG"
    green "✓ pi-mono installed"
  fi

  yellow "→ installing pi-vibehack ($NPM_PKG)..."
  # Forward any caller-supplied flags (e.g., --profile, --planner, --local).
  # Use --package + -- to disambiguate: package is @m4xx101/vibeshack but the
  # exposed bin is `pi-vibehack`, so a bare `npx -y <pkg> install` confuses npx.
  install_with_retry "pi-vibehack install" npx -y --package="$NPM_PKG" -- pi-vibehack install "$@"
  echo

  green "✓ pi-vibehack installed"
  echo

  # WSL PATH-shadowing detection: inside WSL, Windows pi.exe on /mnt/c/... can
  # precede the Linux npm global bin and `pi --version` will silently run the
  # wrong binary. Surface an actionable banner only when we detect the issue.
  if [ -r /proc/version ] && grep -qi microsoft /proc/version; then
    if command -v pi >/dev/null 2>&1; then
      pi_path="$(command -v pi)"
      case "$pi_path" in
        /mnt/c/*|*.exe)
          yellow "⚠ WSL: detected Windows pi at $pi_path shadowing the Linux install."
          echo "  Fix: prepend the Linux npm global bin to PATH so the Linux pi wins:"
          echo "    echo 'export PATH=\"\$(npm config get prefix)/bin:\$PATH\"' >> ~/.bashrc"
          echo "    source ~/.bashrc"
          echo "    which pi   # should now print a Linux path (e.g. ~/.nvm/.../bin/pi)"
          echo
          ;;
      esac
    fi
  fi

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
