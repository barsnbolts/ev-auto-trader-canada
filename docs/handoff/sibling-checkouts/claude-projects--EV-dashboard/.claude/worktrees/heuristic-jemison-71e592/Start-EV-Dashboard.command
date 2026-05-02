#!/usr/bin/env bash
# EV Dashboard — Start
# Double-click this file to launch the dev server. The app opens in your
# browser at http://localhost:1420.
#
# To stop the server, close this Terminal window or press Ctrl-C.

set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Safety check: first-time setup must have run, otherwise node_modules won't exist
# and npm run dev will fail with confusing errors.
if [ ! -d "node_modules" ]; then
    cat <<'NOSETUP'

  ╔════════════════════════════════════════════════════════╗
  ║  ✗ Setup hasn't been run yet.                          ║
  ║                                                        ║
  ║  Double-click "First-Time-Setup.command" first, then   ║
  ║  come back and double-click this file.                 ║
  ╚════════════════════════════════════════════════════════╝

NOSETUP
    echo "Press any key to close…"
    read -n 1 -s
    exit 1
fi

# Ensure Homebrew's bin dir is on PATH in case the shell this .command ran in
# doesn't have the login-shell profile loaded.
if [[ -x "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

cat <<'BANNER'

  ╔════════════════════════════════════════════════════════╗
  ║          EV Dashboard — Starting…                      ║
  ║                                                        ║
  ║  The app will open at http://localhost:1420            ║
  ║                                                        ║
  ║  To stop it: close this window or press Ctrl-C.        ║
  ╚════════════════════════════════════════════════════════╝

BANNER

# Open the browser tab automatically a couple of seconds after Vite starts.
# Runs in the background so it doesn't block the dev server.
(
    sleep 3
    open "http://localhost:1420" 2>/dev/null || true
) &

# Hand off to Vite.
exec npm run dev
