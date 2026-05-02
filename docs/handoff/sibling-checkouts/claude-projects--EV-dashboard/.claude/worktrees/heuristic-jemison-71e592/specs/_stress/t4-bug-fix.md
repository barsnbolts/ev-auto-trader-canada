# t4 — bug-fix probe

**Pre-planted bug:** in `src/lib/format.ts`, `kw()` should round to the nearest 1 kW but currently uses `Math.floor`. So `kw(149.6)` returns 149 instead of 150.

Write a vitest case in `src/lib/format.test.ts` that asserts `kw(149.6)` returns `150 kW`. Run it (red), fix `format.ts` to use `Math.round`, run again (green).
