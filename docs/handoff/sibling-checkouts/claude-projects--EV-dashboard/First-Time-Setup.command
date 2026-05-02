#!/usr/bin/env bash
# EV Dashboard — First-Time Setup
# Double-click this file to install all required dev tools (Homebrew, Node, Rust,
# Python) and the project's npm packages. Safe to re-run; it only installs
# anything that's missing.
#
# You'll be asked for your Mac password once when Homebrew needs to install
# system components. That's the one un-avoidable moment of typing.
# Everything else is automatic.

set -euo pipefail

# Resolve the folder this .command file lives in (handles spaces in path).
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

cat <<'BANNER'

  ╔════════════════════════════════════════════════════════╗
  ║          EV Dashboard — First Time Setup               ║
  ║                                                        ║
  ║  This installs Homebrew, Node, Rust, and Python if     ║
  ║  any are missing. Grab a coffee — takes ~5–10 min on   ║
  ║  a fresh machine. You may be asked for your password   ║
  ║  once.                                                 ║
  ╚════════════════════════════════════════════════════════╝

BANNER

# Make the shell setup script executable in case the file flags didn't survive
# the copy/sync to your Mac, then run it.
chmod +x ./setup.sh
./setup.sh

cat <<'DONE'

  ╔════════════════════════════════════════════════════════╗
  ║  ✓ Setup complete.                                     ║
  ║                                                        ║
  ║  Next step: double-click "Start-EV-Dashboard.command"  ║
  ║  in this same folder to launch the app.                ║
  ║                                                        ║
  ║  You can close this Terminal window now.               ║
  ╚════════════════════════════════════════════════════════╝

DONE

# Leave the window open so you can read the output instead of it slamming shut.
echo "Press any key to close this window…"
read -n 1 -s
