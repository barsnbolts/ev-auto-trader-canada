# CLAUDE.md — ev-auto-trader-canada

Personal-use Next.js 15 EV inventory + dossier tracker. Ian is buying a Hyundai Ioniq 5/6/9 or Kia EV6/EV9 in Canada within 1–2 weeks. Site is live on Vercel preview; primary purpose is research + dealer-call leverage.

## Repo facts (verify, don't memorize)

- **Path:** `~/ev-auto-trader-canada` (NOT `~/Documents/Claude/Projects/EV dashboard/` — that's a sibling project; never cd into it)
- **Branch:** `claude/verify-environment-setup-oTu3S` (never push to `main`)
- **Origin:** `barsnbolts/ev-auto-trader-canada`
- **Stack:** Next.js 15 App Router · Tailwind · Zustand · recharts · TS strict
- **Predeploy gate:** `npm run predeploy` (= `tsc --noEmit && python3 scripts/validate_thermal_specs.py && next build`) must pass before every push
- **Thermal audit:** `npm run thermal-audit` standalone — validates all 31 specs against required fields + physical-plausibility bands. Auto-runs in predeploy. Fails the gate if any spec violates.

## Cwd quirk

Sessions started outside this repo lock the shell cwd to that other folder. After every `Bash` call you'll see `Shell cwd was reset to /Users/ianmcadam/Documents/Claude/Projects/EV dashboard`. Workaround: every Bash starts with `cd ~/ev-auto-trader-canada && …`. All `Read`/`Edit`/`Write` calls use absolute paths under `/Users/ianmcadam/ev-auto-trader-canada/`.

## Operating rules (binding)

**Caveman mode is active by default for chat output.** Drop articles, filler, hedging. Fragments fine. Code/UI copy/commit messages stay normal English.

**Internal thinking discipline.** Think in 1–3 sentences max — pure decision-making. No "let me think about whether..." / "actually wait..." loops. The user can see thinking blocks; they cost tokens.

**No pre-tool narration.** Tool calls communicate intent on their own. Don't say "Now wiring X" then call the tool. Output text only when the user can't infer from tool results.

**No post-action recaps.** Tool results are visible to the user. Don't restate them in a wrap-up message. One-line confirmation max for multi-step work.

**Grep before reading.** `Grep`/`Glob` first; targeted `Read` with offset+limit. Never slurp a >300-line file when you need 20 lines.

**Edit > Write.** Edit sends the diff; Write sends the whole file. Only use Write for new files or full rewrites.

**Chain shell commands with `&&`.** One Bash call beats three. `git add -A && git commit -m "…" && git push origin HEAD` is one round-trip.

**Parallel tool calls when independent.** Multiple `Read`s of unrelated files → one message with multiple tool blocks.

**Todo list discipline.** Update only on real state change (item completed, new high-impact task surfaces). Don't churn it for every micro-step.

**No subagents under 10k tokens of work.** Direct execution wins. Subagents amortize on bigger jobs.

## Anti-hallucination protocol (mandatory checks)

**Verify before claiming.** If you're about to tell the user "predeploy is clean" / "pushed to origin" / "HEAD is X" — actually run the check first. Don't infer from the absence of errors.

**Periodic state checks.** At least once per ~5 turns of substantive work, run a parallel state-verification batch:
```bash
cd ~/ev-auto-trader-canada && git status --short && git rev-parse HEAD && git rev-parse origin/$(git branch --show-current)
```
This catches: uncommitted drift, push failures, branch confusion, file mismatches.

**Edit verification.** After non-trivial Edit/Write to a file the user cares about, Read the changed region back to confirm the change actually landed. Catches encoding issues + match failures.

**Predeploy gate after every functional change.** Never push without `npm run predeploy` exit 0 first. Never assume "it'll be fine" — TS strict + `noUnusedLocals` + `noUnusedParameters` are unforgiving.

**Branch + remote sync check before any push.** If local HEAD ≠ origin HEAD on this branch, the cron may have raced you. `git pull --rebase` before pushing.

**Don't claim a file/function exists without seeing it.** If you reference `computeFinanceOtd` but haven't grep'd it, the user can't trust the line numbers. Either verify or say "search needed."

**Cite sources for data claims.** Heat pump / range / MSRP claims must trace to a CitedValue or queue entry. Never invent numbers, never bump confidence without an actual source URL.

## Tier discipline

User cycles between extra-high / high / medium / sonnet. **Only do things on a given tier that NEED that tier.** On high: architectural decisions, schema changes, cross-file consistency reviews, plans. On medium: execution against a pre-planned spec. On sonnet: bulk mechanical edits, data fills.

When user signals a tier-down ("switching to medium ASAP"): finish the in-progress task, write any remaining architectural decisions into a handoff doc (`docs/handoff/MEDIUM_HANDOFF_*_<date>.md`) so the lower tier executes without re-planning.

## What NOT to do

- Push to `main` (ever)
- `--no-verify`, `--amend`, force-push (ever)
- `cd ~/Documents/Claude/Projects/EV\ dashboard/` (sibling project trap)
- Spend Apify > $30 cumulative without explicit user OK
- Modify `data/specs.json` heat pump values without a queue source backing it
- Hand-edit `data/units.json` (regenerated by `scripts/build_units_from_at.py`)
- Add features for "shipping" — this is personal use only, no signing/notarization/auto-update
- Re-read a file already read this session unless you expect changes
- Restate tool outputs the user already saw

## What's done (context anchor — verify if uncertain)

- All F0–F18 phases shipped (specs port, thermal model, mom-mode tooltips, charging curve, pick-a-model picker + compare, battery degradation, OTD waterfall chart)
- Thermal model now per-vehicle accurate: chemistry + heat pump cutoff + preconditioning + soft cutoff transition. All 31 specs pass the auto-validator
- BC lease tax bug fixed (was flat 12%, now uses BC PST progressive bracket per Bulletin 308)
- TempSlider has preconditioning toggle (`?precon=1`)
- Active medium plan: `docs/handoff/MEDIUM_FULL_PLAN_2026-05-03.md` (7 tasks, all pre-speced)
- Vercel preview live at `barsnbolts-projects/ev-auto-trader-canada`
- Daily refresh cron loaded via launchd

## Carryover (out of current scope)

- O3: Snapshot retention pruning (defer until disk pressure)
- F8: Trip planner (OSRM + charge stops)
- Tauri standalone wrap (post-purchase; main blocker = cookie → localStorage migration)
- Repo rename
