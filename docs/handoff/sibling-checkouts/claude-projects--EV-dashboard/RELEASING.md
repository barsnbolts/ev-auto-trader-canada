# Releasing — Tauri desktop build

Personal-use app, no signing, no distribution. Goal: a `.app` you double-click in Finder.

## One-time icon setup (needed before first build)

Tauri's bundler expects icons in specific sizes. Generate them once from any square PNG source:

```bash
# From the project root, with Tauri CLI already installed (via First-Time-Setup.command):
npm run tauri icon path/to/any/512x512.png
```

This creates `src-tauri/icons/*` with all required sizes + `.icns` + `.ico`.

If you don't have a source icon yet, a placeholder works fine for personal use — even a screenshot of a charging cable resized to 512×512 is enough.

## Build

```bash
npm run tauri:build
```

First build compiles Rust dependencies: **3–6 minutes on an M-series Mac**. Subsequent builds are fast (seconds).

Output: `src-tauri/target/release/bundle/macos/EV Dashboard.app`

## Install

Drag `EV Dashboard.app` to `/Applications`. Launch from Launchpad or Spotlight. Shows up in Dock with whatever icon you provided.

## First launch — Gatekeeper

Because the app isn't signed, macOS will block the first open with "cannot verify developer." One-time workaround:

1. Right-click `EV Dashboard.app` in Applications → **Open**
2. Confirm in the dialog → app launches
3. Subsequent launches work normally (double-click)

## Development (no build needed)

Running the web version is still the daily-dev path:

```bash
./Start-EV-Dashboard.command      # or: npm run dev
```

Opens in Chrome at `localhost:1420`. HMR is instant. Use this for any code change — only rebuild the Tauri `.app` when you want an updated standalone version.

## What's NOT in scope

- Code signing (`$99/yr Apple Developer Program`) — unnecessary for personal use.
- Notarization — same reason.
- Auto-update — not needed. Re-build when you want the latest.
- `.dmg` installer — no distribution, just drag the `.app` to Applications.

## Troubleshooting

**`tauri:build` fails with "icon not found":**
Run the icon generation step above, then retry.

**`tauri:build` fails with Rust version error:**
`rustup update stable` — bring Rust up to date.

**Built app opens but shows blank window:**
Vite build may have failed silently. Run `npm run build` directly and look for errors.

**Launches but localhost:1420 not reachable:**
The Tauri bundle embeds the compiled frontend; it doesn't need a dev server. If you're seeing a "can't connect" error, you're running `tauri:dev` (which does need the dev server) instead of the installed `.app` bundle.
