#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting EV Auto Trader Canada preview..."

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed. Install Node.js 20+ and try again."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed. Install Node.js/npm and try again."
  exit 1
fi

PORT="$(node -e "const net=require('net');let p=3000;const tryPort=()=>{const s=net.createServer();s.once('error',()=>{p++;tryPort();});s.once('listening',()=>{s.close(()=>process.stdout.write(String(p)));});s.listen(p,'127.0.0.1');};tryPort();")"

echo "Using port: ${PORT}"
echo "Opening browser..."
open "http://localhost:${PORT}" || true

echo "Press Ctrl+C in this window to stop the preview server."
PORT="$PORT" npm run preview:offline
