# Phase A Preflight Research — Findings (2026-05-04)

Output of the extra-high preflight research agent before executing Phase
A of the Tauri standalone migration. Goal: find existing tooling that
shrinks Phase A scope. Adapt > build.

## Topic 1 — `create-tauri-app` Next.js template

- **Status:** NOT FOUND (officially) / PARTIAL (community)
- **Recommendation:** skip `create-tauri-app`, adopt `motz0815/tauri-nextjs-starter` config wholesale
- `create-tauri-app` 2.x ships React, Vue, Svelte, SolidJS, Angular,
  Preact, Vanilla — **no Next.js preset**. Picking "React" then bolting
  Next on yourself buys nothing.
- Community starter `motz0815/tauri-nextjs-starter` is exact target
  stack: Tauri v2 + Next 15 + App Router + static export + TS. Use its
  `next.config.ts` and `tauri.conf.json` as drop-in templates.
- **Sources:** https://v2.tauri.app/start/create-project/ ,
  https://github.com/motz0815/tauri-nextjs-starter ,
  https://v2.tauri.app/start/frontend/nextjs/
- **Phase A impact (A6):** stop running `npx create-tauri-app`. New A6 =
  `mkdir src-tauri && cargo init` then paste motz0815-style configs.

## Topic 2 — Tauri 2 icon CLI

- **Status:** FOUND — built-in subcommand
- **Recommendation:** adopt, kill custom build_icon.sh
- Exact command: `npm run tauri icon ./app-icon.png`. Input = squared
  PNG with transparency (1024×1024 recommended). Outputs `icon.icns`,
  `icon.ico`, `32x32.png`, `128x128.png`, etc. into `src-tauri/icons/`.
- **Source:** https://v2.tauri.app/develop/icons/
- **Phase A impact (A8):** A8 collapses to one line. Delete A8 as a
  discrete step; fold into A1 README setup.

## Topic 3 — plugin-fs vs custom Rust

- **Status:** FOUND, with a wrinkle
- **Recommendation:** plugin-fs is sufficient — use `$HOME`-relative
  scope, NOT literal absolute path
- Plugin-fs scope only accepts `$VARIABLE`-prefixed paths from the
  canonical set (`$HOME`, `$APPDATA`, `$DOCUMENT`, `$RESOURCE`, …).
  Literal `/Users/ianmcadam/...` is **not** documented as supported.
  Workaround: `"$HOME/ev-auto-trader-canada/data/**/*"` resolves
  correctly. Path traversal (`..`) blocked. Case-sensitive on macOS.
- **Sources:** https://v2.tauri.app/plugin/file-system/ ,
  https://github.com/orgs/tauri-apps/discussions/11792
- **Phase A impact (A7):** A7 shrinks dramatically. Replace Rust
  commands with capabilities config:
  ```json
  { "identifier": "fs:scope",
    "allow": [{ "path": "$HOME/ev-auto-trader-canada/data/**/*" }] }
  ```
  Frontend uses `import { readTextFile } from '@tauri-apps/plugin-fs'`.
  Zero Rust written. Saves ~80% of A7.

## Topic 4 — Next 15 static export gotchas

- **Status:** FOUND, several mandatory mitigations
- **Mitigations required:**
  - [ ] Wrap **every** client component using `useSearchParams()` in
    `<Suspense>`. Dev mode hides the failure; production build
    hard-fails. Audit all 13 routes before A4.
  - [ ] All dynamic routes (`[id]`, `[slug]`) **must** export
    `generateStaticParams()` returning the full id list — no
    `dynamicParams: true`.
  - [ ] Remove any API routes; only `GET` route handlers survive
    (rendered to static JSON at build).
  - [ ] **Forbidden APIs**: `cookies()`, `headers()`, `redirect()`,
    `rewrites`, server actions, middleware, ISR, draft mode,
    intercepting routes. Grep codebase before A4.
  - [ ] `next/image` with `unoptimized: true` ships browser-native
    `<img>` — fine in WKWebView, but `loading="lazy"` works
    inconsistently in older WKWebView; acceptable risk for
    personal-use scope.
  - [ ] `trailingSlash: true` is **optional** per official docs — only
    needed if static host can't rewrite. Tauri's WKWebView serves
    files directly, so adding it is defensive but not load-bearing.
    Recommend: keep it.
  - [ ] `assetPrefix` should be conditional on
    `TAURI_DEV_HOST`/`isProd` per official Tauri docs — copy
    motz0815's pattern verbatim.
- **Sources:** https://nextjs.org/docs/app/guides/static-exports ,
  https://nextjs.org/docs/app/api-reference/functions/use-search-params ,
  https://v2.tauri.app/start/frontend/nextjs/
- **Phase A impact (A4):** add new step **A4.0 — static-export audit**:
  grep for `useSearchParams|cookies()|headers()|redirect(|server-only|"use server"|export.*POST|app/api/` across `src/app/**`. Triage each. Then proceed.

## Topic 5 — Reference repos

| Repo | Last commit | Stars | Reusable | Notes |
|---|---|---|---|---|
| [motz0815/tauri-nextjs-starter](https://github.com/motz0815/tauri-nextjs-starter) | recent | 1 | `next.config.ts`, `tauri.conf.json`, package scripts | Exact stack match. CSP `null`, frontendDist `../out`, devUrl `localhost:3000`. Bun-based — swap to npm trivially. |
| [kvnxiao/tauri-nextjs-template](https://github.com/kvnxiao/tauri-nextjs-template) | recent | higher | App Router + Tailwind + GitHub Actions | Currently on Next 16. Older commits have Next 15 era. Useful for CI patterns we don't need (personal use). |
| [julibuilds/NexTauri-2](https://github.com/julibuilds/NexTauri-2) | recent | low-mid | full-stack reference (auth, i18n, MongoDB) | Overkill. Skip. |
| [Arbarwings/tauri-v2-nextjs-monorepo](https://github.com/Arbarwings/tauri-v2-nextjs-monorepo) | recent | low | monorepo + multi-platform | Wrong shape. Skip. |
| [permafrost-dev/nextjs-tauri-template](https://github.com/permafrost-dev/nextjs-tauri-template) | older | low | Next + TS + Tailwind | Likely Tauri 1 era. Skip. |

## Net Phase A scope changes

- **A6:** **shrunk** — skip `create-tauri-app`, use `cargo init` + paste
  motz0815 configs.
- **A7:** **replaced** — Rust commands killed entirely. Replace with
  `@tauri-apps/plugin-fs` + capabilities scope. `src/lib/dataClient.ts`
  switches static imports to `readTextFile()` calls behind a
  Tauri-runtime check (or stays as static imports — both work since
  bundle is shipped with the .app).
- **A8:** **killed** — `npm run tauri icon` replaces custom shell
  script.
- **A4:** **mitigations added** — pre-audit step A4.0 for forbidden APIs
  + Suspense wrapping for `useSearchParams`.
- **New steps:**
  - A4.0 — Static-export compatibility audit (grep + triage).
  - A6.5 — Install `@tauri-apps/plugin-fs` + register in Rust `lib.rs`
    (one line: `.plugin(tauri_plugin_fs::init())`).
- **Steps deleted:** A8 (custom build_icon.sh), A7 Rust command
  authoring (replaced by config).
- **Estimated token savings:** 25-40k.

## Decision log — what we adopt vs. build

| Item | Source | Action |
|---|---|---|
| `tauri.conf.json` shape | motz0815/tauri-nextjs-starter | copy + customize CSP, window |
| `next.config.ts` env-toggle pattern | motz0815/tauri-nextjs-starter | already shipped (next.config.mjs A1 commit) |
| Icon generation | `npm run tauri icon` | adopt, kill build_icon.sh |
| Data file reads | `@tauri-apps/plugin-fs` + `$HOME` scope | adopt, kill Rust commands |
| Static JSON imports in dataClient.ts | already in repo | bundle-time imports remain primary path; plugin-fs is fallback for runtime "live" reads |

## Next move

1. Run A4.0 audit grep against `src/app/**` to surface server-only API usage that blocks static export.
2. Triage findings — every `cookies()`, `headers()`, `useSearchParams()` (without Suspense) gets a fix in A4.
3. Continue Phase A with shrunken scope: A3 → A4.0 → A4 → A5 → A6 → A6.5 → A9 → tauri icon → A10 → A11.
