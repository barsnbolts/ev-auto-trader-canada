#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
APP_NAME="EVAutoTraderCanada"
EXECUTABLE_NAME="EVAutoTraderApp"
BUNDLE_ID="com.ianmcadam.evautotradercanada"
MIN_SYSTEM_VERSION="26.0"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
QA_DIR="$ROOT_DIR/qa"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_CONTENTS="$APP_BUNDLE/Contents"
APP_MACOS="$APP_CONTENTS/MacOS"
APP_RESOURCES="$APP_CONTENTS/Resources"
APP_BINARY="$APP_MACOS/$EXECUTABLE_NAME"
INFO_PLIST="$APP_CONTENTS/Info.plist"
MODULE_CACHE="$ROOT_DIR/.build/clang-module-cache"

mkdir -p "$DIST_DIR" "$MODULE_CACHE"

pkill -x "$EXECUTABLE_NAME" >/dev/null 2>&1 || true

export CLANG_MODULE_CACHE_PATH="$MODULE_CACHE"

swift build --product "$EXECUTABLE_NAME"
BUILD_BINARY="$(swift build --product "$EXECUTABLE_NAME" --show-bin-path)/$EXECUTABLE_NAME"

rm -rf "$APP_BUNDLE"
mkdir -p "$APP_MACOS" "$APP_RESOURCES"
cp "$BUILD_BINARY" "$APP_BINARY"
chmod +x "$APP_BINARY"

cat >"$INFO_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>$EXECUTABLE_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>$BUNDLE_ID</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>$MIN_SYSTEM_VERSION</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSPrincipalClass</key>
  <string>NSApplication</string>
</dict>
</plist>
PLIST

open_app() {
  /usr/bin/open -n "$APP_BUNDLE"
}

case "$MODE" in
  run)
    open_app
    ;;
  --debug|debug)
    lldb -- "$APP_BINARY"
    ;;
  --logs|logs)
    open_app
    /usr/bin/log stream --info --style compact --predicate "process == \"$EXECUTABLE_NAME\""
    ;;
  --telemetry|telemetry)
    open_app
    /usr/bin/log stream --info --style compact --predicate "subsystem == \"$BUNDLE_ID\""
    ;;
  --verify|verify)
    open_app
    sleep 1
    pgrep -x "$EXECUTABLE_NAME" >/dev/null
    ;;
  --verify-ui|verify-ui)
    mkdir -p "$QA_DIR"
    open_app
    sleep 3
    pgrep -x "$EXECUTABLE_NAME" >/dev/null
    SCREENSHOT="$QA_DIR/${APP_NAME}-$(date +%Y%m%d-%H%M%S).png"
    if /usr/sbin/screencapture -x -m "$SCREENSHOT"; then
      echo "visual qa screenshot: $SCREENSHOT"
    else
      rm -f "$SCREENSHOT"
      echo "visual qa screenshot unavailable; app process verified. Grant Screen Recording permission to the terminal/Codex app to capture screenshots." >&2
    fi
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify|--verify-ui]" >&2
    exit 2
    ;;
esac
