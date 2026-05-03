#!/usr/bin/env bash
# pi-vibehack curl-pipe installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/m4xx101/pi-vibehack/v1.1-dev/install.sh | bash
#
# With flags:
#   curl -fsSL .../install.sh | bash -s -- --profile local
#   curl -fsSL .../install.sh | bash -s -- --with-dcp     # opt into Dynamic Context Pruning
#
# Inspect first if you prefer:
#   curl -fsSL .../install.sh | less

set -euo pipefail

NPM_PKG="@m4xx101/vibeshack"
PI_PKG="@mariozechner/pi-coding-agent"
REPO="https://github.com/m4xx101/pi-vibehack"
NPM_TAG="${VIBEHACK_NPM_TAG:-rc}"

# ── colors ─────────────────────────────────────────────────────────────────
if [ -t 1 ] && [ "${TERM:-}" != "dumb" ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_BOLD=$'\033[1m'
  C_RED=$'\033[0;31m'; C_GREEN=$'\033[0;32m'; C_YELLOW=$'\033[0;33m'
  C_BLUE=$'\033[0;34m'; C_MAGENTA=$'\033[0;35m'; C_CYAN=$'\033[0;36m'
else
  C_RESET=""; C_DIM=""; C_BOLD=""
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_MAGENTA=""; C_CYAN=""
fi

red()    { printf "%s%s%s\n" "$C_RED"     "$*" "$C_RESET"; }
green()  { printf "%s%s%s\n" "$C_GREEN"   "$*" "$C_RESET"; }
yellow() { printf "%s%s%s\n" "$C_YELLOW"  "$*" "$C_RESET"; }
blue()   { printf "%s%s%s\n" "$C_BLUE"    "$*" "$C_RESET"; }
cyan()   { printf "%s%s%s\n" "$C_CYAN"    "$*" "$C_RESET"; }
dim()    { printf "%s%s%s\n" "$C_DIM"     "$*" "$C_RESET"; }
bold()   { printf "%s%s%s\n" "$C_BOLD"    "$*" "$C_RESET"; }

# ── banner ─────────────────────────────────────────────────────────────────
banner() {
  printf "\n"
  printf "%s%s    ╔══════════════════════════════════════════════════════╗%s\n"  "$C_BOLD" "$C_MAGENTA" "$C_RESET"
  printf "%s%s    ║                                                      ║%s\n"   "$C_BOLD" "$C_MAGENTA" "$C_RESET"
  printf "%s%s    ║      π · %sP I - V I B E H A C K%s                       %s║%s\n" \
         "$C_BOLD" "$C_MAGENTA" "$C_CYAN" "$C_MAGENTA" "$C_BOLD$C_MAGENTA" "$C_RESET"
  printf "%s%s    ║                                                      ║%s\n"   "$C_BOLD" "$C_MAGENTA" "$C_RESET"
  printf "%s%s    ║   %shypothesis-tree harness on pi-mono%s                 %s║%s\n" \
         "$C_BOLD" "$C_MAGENTA" "$C_DIM$C_RESET" "$C_BOLD$C_MAGENTA" "$C_BOLD$C_MAGENTA" "$C_RESET"
  printf "%s%s    ║   %sself-evolving · canary-verified · context-aware%s   %s║%s\n" \
         "$C_BOLD" "$C_MAGENTA" "$C_DIM$C_RESET" "$C_BOLD$C_MAGENTA" "$C_BOLD$C_MAGENTA" "$C_RESET"
  printf "%s%s    ║                                                      ║%s\n"   "$C_BOLD" "$C_MAGENTA" "$C_RESET"
  printf "%s%s    ╚══════════════════════════════════════════════════════╝%s\n"   "$C_BOLD" "$C_MAGENTA" "$C_RESET"
  printf "         %srepo:%s %s\n"     "$C_DIM" "$C_RESET" "$REPO"
  printf "         %snpm: %s %s@%s\n"  "$C_DIM" "$C_RESET" "$NPM_PKG" "$NPM_TAG"
  printf "\n"
}

# ── step indicator ─────────────────────────────────────────────────────────
STEP_NUM=0
STEP_TOTAL=5
step() {
  STEP_NUM=$((STEP_NUM + 1))
  printf "%s[%d/%d]%s %s%s%s\n" "$C_CYAN" "$STEP_NUM" "$STEP_TOTAL" "$C_RESET" "$C_BOLD" "$*" "$C_RESET"
}
ok()    { printf "      %s✓%s %s\n" "$C_GREEN"  "$C_RESET" "$*"; }
warn()  { printf "      %s⚠%s %s\n" "$C_YELLOW" "$C_RESET" "$*"; }
fail()  { printf "      %s✗%s %s\n" "$C_RED"    "$C_RESET" "$*"; }
info()  { printf "      %s%s%s\n"   "$C_DIM"    "$*"       "$C_RESET"; }

require() {
  command -v "$1" >/dev/null 2>&1 || {
    fail "required command not found: $1"
    info "install hint: $2"
    exit 1
  }
}

# Detect-and-retry wrapper for npm operations that may hit the
# @stacksjs/clarity bunx-git-hooks postinstall failure.
install_with_retry() {
  local label="$1"; shift
  local logfile; logfile="$(mktemp -t pi-install.XXXXXX.log)"
  : > "$logfile"
  if "$@" 2> >(tee -a "$logfile" >&2); then
    rm -f "$logfile"
    return 0
  fi
  if grep -qE 'git-hooks|@stacksjs/clarity|postinstall' "$logfile"; then
    warn "$label hit known transitive postinstall failure"
    info "retrying with --ignore-scripts (safe — only skips dev-time git-hooks setup)"
    if [ "$1" = "npm" ]; then
      local cmd=("$1" "$2"); shift 2
      cmd+=(--ignore-scripts "$@")
      if "${cmd[@]}"; then
        rm -f "$logfile"
        return 0
      fi
    else
      if npm_config_ignore_scripts=true "$@"; then
        rm -f "$logfile"
        return 0
      fi
    fi
  fi
  fail "$label failed"
  info "log: $logfile"
  return 1
}

main() {
  banner

  step "checking prerequisites"
  require node "https://nodejs.org (Node 18+)"
  require npm  "ships with Node"
  node_version=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt 18 ]; then
    fail "Node $node_version is too old; need 18+"
    exit 1
  fi
  ok "node $(node -v)"
  ok "npm  $(npm -v)"

  step "installing pi-mono ($PI_PKG)"
  if command -v pi >/dev/null 2>&1; then
    ok "already installed: $(pi --version 2>&1 | head -1 || echo detected)"
  else
    install_with_retry "pi-mono install" npm install -g "$PI_PKG"
    ok "installed"
  fi

  step "installing pi-vibehack ($NPM_PKG@$NPM_TAG)"
  install_with_retry "pi-vibehack install" npm install -g "${NPM_PKG}@${NPM_TAG}"
  ok "installed: $(pi-vibehack --version 2>&1 | head -1 || echo "@$NPM_TAG")"

  step "configuring pi-vibehack"
  pi-vibehack install "$@"

  step "post-install checks"
  # WSL PATH-shadowing detection
  if [ -r /proc/version ] && grep -qi microsoft /proc/version; then
    if command -v pi >/dev/null 2>&1; then
      pi_path="$(command -v pi)"
      case "$pi_path" in
        /mnt/c/*|*.exe)
          warn "WSL: Windows pi at $pi_path is shadowing the Linux install"
          info "fix: prepend Linux npm bin to PATH —"
          info "  echo 'export PATH=\"\$(npm config get prefix)/bin:\$PATH\"' >> ~/.bashrc"
          info "  source ~/.bashrc && which pi"
          ;;
      esac
    fi
  else
    ok "no PATH issues detected"
  fi

  printf "\n"
  cyan "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  bold "  next steps"
  cyan "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "    %s1.%s boot pi:                     %spi%s\n"                "$C_GREEN" "$C_RESET" "$C_BOLD" "$C_RESET"
  printf "    %s2.%s start engagement:           %s/vibehack <target>%s\n" "$C_GREEN" "$C_RESET" "$C_BOLD" "$C_RESET"
  printf "    %s3.%s watch the tree:             %s/vibehack-tree%s\n"    "$C_GREEN" "$C_RESET" "$C_BOLD" "$C_RESET"
  printf "\n    %soptional power-ups:%s\n" "$C_DIM" "$C_RESET"
  printf "      %snpm i -g pi-super-curl%s   %s# HTTP/auth surface%s\n"   "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
  printf "      %snpm i -g surf-cli%s        %s# browser automation%s\n"  "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
  printf "\n"
  yellow "  ⚠ AUTHORIZED TESTING ONLY"
  info "    The operator is responsible for authorization."
  info "    Do not use against systems you do not own or have explicit written permission to test."
  printf "\n"
}

main "$@"
