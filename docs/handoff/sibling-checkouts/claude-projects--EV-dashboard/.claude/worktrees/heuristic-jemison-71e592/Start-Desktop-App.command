#!/usr/bin/env bash
# EV Dashboard — Standalone Desktop App (Tauri)
# Double-click this file to launch the app as a real Mac desktop window —
# no browser tab, just a native window like any other Mac app.
#
# First-run note: this needs to compile Rust dependencies the first time.
# Expect 3–5 minutes on an Apple Silicon Mac. You'll see Cargo progress
# output — that's normal. Subsequent launches are near-instant.
#
# Close the Terminal window to quit the app.

set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Safety: require first-time setup to have run
if [ ! -d "node_modules" ]; then
    cat <<'NOSETUP'

  ╔════════════════════════════════════════════════════════╗
  ║  ✗ Setup hasn't been run yet.                          ║
  ║                                                        ║
  ║  Double-click "First-Time-Setup.command" first.        ║
  ╚════════════════════════════════════════════════════════╝

NOSETUP
    echo "Press any key to close…"
    read -n 1 -s
    exit 1
fi

# Safety: require Rust for Tauri builds
if ! command -v cargo >/dev/null 2>&1; then
    # Load rustup env if it was installed but not on PATH in this shell
    [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
fi
if ! command -v cargo >/dev/null 2>&1; then
    cat <<'NORUST'

  ╔════════════════════════════════════════════════════════╗
  ║  ✗ Rust isn't installed.                               ║
  ║                                                        ║
  ║  Re-run "First-Time-Setup.command" — it installs Rust. ║
  ╚════════════════════════════════════════════════════════╝

NORUST
    echo "Press any key to close…"
    read -n 1 -s
    exit 1
fi

# Ensure Homebrew bin is on PATH for node
if [[ -x "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

cat <<'BANNER'

  ╔════════════════════════════════════════════════════════╗
  ║          EV Dashboard — Desktop App                    ║
  ║                                                        ║
  ║  Launching as a standalone Mac window.                 ║
  ║  First run compiles Rust (3–5 min). Be patient.        ║
  ║  Subsequent launches are near-instant.                 ║
  ║                                                        ║
  ║  Close this Terminal to quit the app.                  ║
  ╚════════════════════════════════════════════════════════╝

BANNER

exec npm run tauri:dev
