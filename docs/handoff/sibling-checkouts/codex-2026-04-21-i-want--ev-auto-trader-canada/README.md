# ev-auto-trader-canada

## One place for everything
This repository now keeps all runnable preview pieces together:
- sample data: `data/vehicles.sample.json`
- offline server: `scripts/preview-offline.mjs`
- launcher: `start.command`
- docs/status: `README.md`, `docs/current-status.md`
- downloadable outputs: `artifacts/`

## Run modes

### 1) Normal Next.js mode (full stack)
Use this only when dependencies can be installed in the current environment.

```bash
npm install
npm run preflight
npm run dev
```

Condition: use this when `npm install` succeeds and monorepo app files are available.

### 2) No-install offline preview mode (works without node_modules)
Use this when installs are blocked (e.g., npm 403) or when you need an immediate preview in the current session.

```bash
npm run preview:offline
```

Then open `http://localhost:3000` (or the nearest available port printed by the script).

What you will see:
- Top navigation sections matching app intent.
- Vehicle cards from sample EV data (loaded from `data/vehicles.sample.json`).
- Compare-style table.
- Missing-data summary block.
- Data provenance / sample-mode notice.

### 3) Mac double-click launcher (easiest)
If you're on macOS, double-click `start.command` in Finder.

What it does:
- Finds the nearest available local port (starting at 3000).
- Opens your browser automatically.
- Starts the preview server.

If macOS blocks it the first time:
1. Right-click `start.command`.
2. Click **Open**.
3. Confirm **Open** in the warning dialog.

### 4) Build local downloadable artifacts in-repo
Create downloadable outputs directly inside this repository (so everything stays in one place):

```bash
npm run bundle:offline
```

Outputs:
- `artifacts/offline-preview.html`
- `artifacts/ev-auto-trader-canada-offline.zip`

## Quick checks

```bash
node scripts/health-check.mjs
npm run queue:next
```


## Continue on Codex MacBook Pro app
Everything from today is now captured in-repo so you can continue on your Mac without losing context:
- Full handoff: `docs/handoff-codex-macbook.md`
- Ordered/parallel task board: `docs/task-board.md`
- Locked decisions (machine-readable): `docs/session-decisions.json`

Use this flow:
```bash
cd ev-auto-trader-canada
npm run preview:offline
```

If you need a portable bundle from inside this repo:
```bash
npm run bundle:offline
```

