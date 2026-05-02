# Current status

## Normal Next.js path
Use this path when the repository includes the full Next.js monorepo sources and `npm install` succeeds.

1. `npm install`
2. `npm run preflight`
3. `npm run dev`

If these steps work, the full monorepo developer experience is available.

## Fallback no-install preview path
Use this path when dependency installation is blocked (for example, registry/network restrictions such as npm 403 errors) or when `node_modules` is unavailable.

1. `npm run preview:offline`
2. Open `http://localhost:3000` (or the next available port shown in terminal output).

This mode uses built-in Node.js only and serves a static sample page with navigation, vehicle cards, compare table, missing-data summary, and provenance notice.

## All-in-one repository path
If you need everything consolidated in one place, run:

1. `npm run bundle:offline`
2. Use files generated under `artifacts/`.

This keeps snapshot HTML and ZIP outputs directly in this repository.

## Session continuity package (today)
To continue on Codex MacBook Pro with all context in-repo:
- `docs/handoff-codex-macbook.md`
- `docs/task-board.md`
- `docs/session-decisions.json`
