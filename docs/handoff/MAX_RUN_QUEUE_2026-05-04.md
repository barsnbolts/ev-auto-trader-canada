# Max Run Queue — 2026-05-04

Pre-baked work queue for the Max-tier session. Switch from extra-high to
Max here. All architecture decisions locked. Medium can finish the
mechanical fill afterward without re-thinking patterns.

## State at handoff

- **HEAD:** `83d7f7b7` (env-toggled next.config.mjs pushed)
- **Branch:** `claude/verify-environment-setup-oTu3S`
- **Plan file:** `/Users/ianmcadam/.claude/plans/you-are-the-planning-floating-breeze.md` (V7-final, 3172 lines)
- **Research findings:** `docs/handoff/research/PHASE_A_PREFLIGHT_2026-05-04.md`
- **Phase A scope changes:** A7 killed (plugin-fs replaces Rust commands), A8 killed (`npm run tauri icon` replaces build_icon.sh), A6 shrunk (skip create-tauri-app, copy motz0815 starter)

### What's already shipped this session

| Item | Status | Verified |
|---|---|---|
| A1 next.config.mjs env-toggle | committed `83d7f7b7` + pushed | ✓ |
| A2 src/lib/dataClient.ts | uncommitted, on disk | typecheck ✓ |
| A3 scripts/build_static_meta.py + data/meta-static.json | uncommitted, on disk | output verified |
| A0-bis preflight research | uncommitted doc | ✓ |
| A4 homepage (src/app/page.tsx) client conversion | uncommitted | typecheck ✓ |

## Route conversion template — proven on src/app/page.tsx

Use this verbatim for the remaining 5 client conversions. Body JSX stays
unchanged; only header + data load mutate.

```tsx
"use client";

import { useEffect, useState } from "react";
// ... static imports unchanged (Link, components)
import { loadScoredUnits, loadX, loadY } from "@/lib/dataClient";  // was @/lib/data
import { useBuyerContext } from "@/lib/buyerContext";              // was buyerContextServer
// drop: import { getBuyerContext } from "@/lib/buyerContextServer"

// drop: export const dynamic = "force-dynamic";

type PageData = {
  scored: Awaited<ReturnType<typeof loadScoredUnits>>;
  // ... other loaders' return shapes
};

export default function PageName() {
  const { buyerContext } = useBuyerContext();
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadScoredUnits(buyerContext), loadX(), loadY()])
      .then(([scored, x, y]) => { if (!cancelled) setData({ scored, x, y }); });
    return () => { cancelled = true; };
  }, [buyerContext]);

  if (!data) return <SkeletonMatchingLayout />;

  const { units, dealers, dealerById, incentives } = data.scored;
  // ... rest of JSX unchanged
}
```

### Variants per route

| Route | Cookie | searchParams | Dynamic param | Extra |
|---|---|---|---|---|
| `src/app/page.tsx` | ✓ | — | — | done |
| `src/app/inventory/page.tsx` | ✓ | runtime | — | wrap in `<Suspense>` for useSearchParams |
| `src/app/inventory/[id]/dossier/page.tsx` | ✓ | runtime | `[id]` → `useParams()` | + generateStaticParams |
| `src/app/dealer/[id]/page.tsx` | ✓ | — | `[id]` → `useParams()` | + generateStaticParams |
| `src/app/compare/page.tsx` | ✓ | — | — | — |
| `src/app/pick-a-model/compare/page.tsx` | — | runtime ids= | — | wrap in `<Suspense>` |
| `src/app/pick-a-model/page.tsx` | — | — | — | drop force-dynamic only, keep server |

For Suspense wraps, wrap the inner client logic and export a default
that provides the boundary:

```tsx
import { Suspense } from "react";

function InventoryInner() {
  const sp = useSearchParams();
  // ... existing logic
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<InventoryLoading />}>
      <InventoryInner />
    </Suspense>
  );
}
```

## Max-run shopping list (in execution order)

### Phase A finish (~25k tokens)

1. **A4 remaining 6 routes** — apply template above to:
   - `src/app/inventory/page.tsx`
   - `src/app/inventory/[id]/dossier/page.tsx`
   - `src/app/dealer/[id]/page.tsx`
   - `src/app/compare/page.tsx`
   - `src/app/pick-a-model/compare/page.tsx`
   - `src/app/pick-a-model/page.tsx` (drop force-dynamic only — no client conversion)
2. **A5 generateStaticParams** — 6-line additions to `dossier/page.tsx` and `dealer/[id]/page.tsx`:
   ```tsx
   import unitsJson from "@/data/units.json";
   export function generateStaticParams() {
     return (unitsJson as Array<{ id: string }>).map((u) => ({ id: u.id }));
   }
   ```
3. **A6 src-tauri scaffold** — `cargo init src-tauri --lib`, paste `tauri.conf.json` (see plan §V7), `Cargo.toml`, `src/lib.rs` with `.plugin(tauri_plugin_fs::init())`.
4. **A6.5 plugin-fs install + capabilities** — `npm i @tauri-apps/plugin-fs`, write `src-tauri/capabilities/main.json` with `$HOME/ev-auto-trader-canada/data/**/*` scope.
5. **A8 icon** — `npm run tauri icon ./assets/ev-monogram-1024.png` (need to draw a 1024 PNG first; can use `magick -size 1024x1024 xc:#0a0a0b -fill #28a745 ... label:"EV"` or hand-build).
6. **A9 npm scripts** — add `dev:tauri`, `build:tauri`, `predeploy:tauri` to `package.json`.
7. **A10 verification gauntlet** — `npm run predeploy:tauri`, `npx serve out -p 4000`, `npm run dev:tauri`, `npm run build:tauri`. Halt on twice-failed Tauri build per plan rules.
8. **A11 Phase A commit + push** — single commit with co-author tag.

### Phase B core (architecture-heavy, ~25k tokens) — only if Phase A clears

1. **B1 Tauri Rust command `run_refresh(app)`** — spawns
   `scripts/refresh_daily.sh`, streams stdout/stderr lines via
   `app.emit("refresh-log", line)`. Pattern goes in `src-tauri/src/lib.rs`.
2. **B2 RefreshModal.tsx** — `import { listen } from "@tauri-apps/api/event"`, scrolling log + progress bar + delta count.
3. **B3 verify_unit.py** — Python re-scrape script (single VIN, reads `units.json` for listing URL, fetches AutoTrader, returns parsed JSON).
4. **B4 Rust command `run_verify_unit(unit_id)`** — spawns `verify_unit.py`, returns parsed JSON.
5. **B5 UnitVerifyChip.tsx** — calls `run_verify_unit`, chip states ⏳/✓/✗.
6. **B6 dossier integration** — render `<UnitVerifyChip unitId={id} />` next to header.

### Hand-off threshold

After Phase A11 (Phase A commit pushed), **drop tier from Max → medium**.
Phase B can be split: B1 + B4 are HIGH (Rust IPC patterns); B2/B3/B5/B6
are medium-tier mechanical fill. If Max budget remains, do B1 + B4.
Otherwise commit Phase A and queue Phase B for medium.

## Token budget targets (Max session)

| Block | Estimate | Tier |
|---|---|---|
| Phase A finish (A4 × 6 + A5–A11) | 25k | mostly mechanical |
| Phase A verification + bug-fixes | 5k | medium |
| Phase B IPC architecture (B1+B4 only) | 15k | HIGH |
| Phase B UI + scripts (B2/B3/B5/B6) | 15k | medium |
| **Max session ceiling** | **60k** | mixed |

If Max session burns through 60k cleanly, spill into Phase C dock badge
or queue-and-stop. Hard halt: 90k.

## Stop conditions (binding for Max session)

- Tauri build fails twice on same root cause → halt, commit progress, write to `docs/handoff/TAURI_BUILD_LOG.md`
- Predeploy fails twice on same root cause → halt
- About to add code-signing or notarization → halt (CLAUDE.md NO list)
- About to push to `main` → halt
- About to spend > $30 on Apify → halt
- Budget hits 90k → halt and commit

## Resume recipe (if Max session interrupts)

```
cd ~/ev-auto-trader-canada
git status --short
git log --oneline -5
cat docs/handoff/MAX_RUN_QUEUE_2026-05-04.md  # this doc
cat docs/handoff/TAURI_BUILD_LOG.md           # if exists
```

Then continue from the next un-checked item in the shopping list above.

## Decisions baked in (no re-litigation in Max)

1. Single-file client conversion for all 6 remaining routes (no server shell + client child split).
2. plugin-fs `$HOME` scope replaces hand-rolled Rust commands (per A0-bis research).
3. `npm run tauri icon` replaces custom build_icon.sh.
4. `cargo init src-tauri --lib` then paste motz0815-style configs (skip create-tauri-app).
5. CSP allows AutoTrader, Kijiji, Hyundai/Kia, Leasebusters, Carfax (Phase D ready).
6. App icon = "EV" monogram on accent-dim tile (option B from plan).
7. arm64-only build; no signing; no DMG; no notarization.
8. Phase A → B → C → D → E delivery; no leapfrogging.
9. Refresh feedback = modal with progress bar + log (Phase B).
10. Per-unit verify = on dossier page only, not inventory rows (Phase B).

If any veto required, edit this doc before flipping the tier.
