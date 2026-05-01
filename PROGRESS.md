# PROGRESS — EV Auto Trader Canada

> Self-handoff log. When picking the project back up, read **Status snapshot**
> below, then **Up next**, then advance the topmost item by one cohesive unit
> of work and update this file. Most recent entry on top.

## How to use this file

1. Read the **Status snapshot** below.
2. Read the **Up next** queue.
3. Pick the topmost pending item, do it, and record what you did under
   **Run log**. Move the item from "Up next" to "Done" if fully complete.
4. If you discover follow-up work, append to "Up next" rather than silently
   doing it.

---

## Status snapshot

- **Tech**: Next.js 15 (App Router) · TypeScript strict · Tailwind 3 ·
  recharts · zod
- **Where data lives**: `/data/units.json`, `/data/dealers.json`,
  `/data/incentives.json`, `/data/snapshots/*.json`
- **Where logic lives**: `src/lib/{types,constants,scoring,format,data,aggregations}.ts`
- **Pages**: `/` (dashboard), `/inventory`, `/compare`, `/incentives`, `/history`
- **Branch**: `claude/ev-inventory-tracker-3IwyA` — **never push to main**
- **Local-only**: not yet hosted; user runs `npm run dev` locally
- **Skill installed**: `caveman` at `.claude/skills/caveman/SKILL.md` plus
  `/caveman`, `/caveman-init`, `/caveman-commit`, `/caveman-review` slash
  commands at `.claude/commands/`

## Up next (priority order)

1. **Validate first run.** Run `npm install`, `npm run typecheck`, and
   `npm run dev`. Hit each route in a browser; fix any runtime errors. The
   sample data in `/data/*.json` should render the dashboard, inventory,
   compare, incentives, and history pages out of the box.
2. **Real GTA inventory pass.** Generate the prompt
   `research-prompts/01-inventory-gta.md` for the user to run in
   ChatGPT/Gemini. Replace the seeded units in `data/units.json` with the
   real result, preserving the `u-XXX` id scheme.
3. **Real incentives verification.** Run `research-prompts/03-incentives.md`,
   especially to confirm whether **federal iZEV** has been reinstated since
   the January 2025 pause. Update `data/incentives.json` accordingly and bump
   `lastVerified` to today's date.
4. **Real dealer registry.** Run `research-prompts/04-dealers.md` to expand
   `data/dealers.json` from the current 22 sample entries to the full
   Canadian Kia + Hyundai network.
5. **Canada-wide inventory.** Run `research-prompts/02-inventory-canada.md`
   and append non-GGH units. Watch for `_newDealers` appended at the end of
   the JSON output and merge those into `dealers.json` first.
6. **Specs & trim catalog.** Once the above settle, run
   `research-prompts/05-specs-and-trims.md` to seed `data/specs.json` (does
   not yet exist — when first written, also extend `src/lib/types.ts` with a
   `SpecSchema` and surface the data on the compare page).
7. **First snapshot after refresh.** `npm run snapshot`.
8. **UX polish backlog** (only after data is real):
    - Add a per-unit detail drawer (click a row in the inventory table).
    - Map view: dealer pins colored by pressure score.
    - "Negotiation script" generator: given a unit, produce a short
      caveman-style email to send the dealer (uses the `caveman` skill).
    - Notification stub (out-of-scope per spec; revisit if user re-asks).

## Done

- Project scaffold: configs, tailwind theme, layout, nav.
- Data schemas + validation (zod).
- OTD math + deal score + dealer pressure index.
- Sample data: 22 dealers, 28 units, 18 incentives, 2 snapshots.
- Pages: dashboard / inventory / compare / incentives / history.
- Snapshot script (`npm run snapshot`).
- Research-prompt files (01–05) under `research-prompts/`.
- Caveman skill + slash commands installed at project level.
- PROGRESS.md and README updated.

## Run log

- **Initial build** — full scaffold, sample data, pages, scoring, research
  prompts, caveman install, PROGRESS.md.
