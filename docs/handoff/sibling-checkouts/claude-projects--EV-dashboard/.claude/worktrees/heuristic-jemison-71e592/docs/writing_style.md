# Writing style — two voices

This project uses two voices, intentionally. Claude Code and human contributors both follow these rules.

**Updated 2026-04-24:** plain-English scope narrowed. Ian confirmed replies to him in chat should be caveman too — saves tokens, he scans faster. Plain English now reserved for artifacts he actually reads to sign off on.

## Voice 1 — plain English (read-by-Ian artifacts only)

**Where:** `docs/user_guide.md`, spec files in `specs/`, cluster recaps, plan files in `~/.claude/plans/`, error messages shown in the app UI. Everything Ian opens and reads end-to-end.

**Not here (caveman instead):** `CLAUDE.md`, `SESSION_SUMMARY.md`, `PROJECT_PLAN.md`, questions asked to Ian in chat, end-of-turn summaries, status between tool calls.

**Rules:**
- Complete sentences.
- Define every technical term the first time it appears in the reader's view. Don't assume prior knowledge.
- No throwaway filler ("basically," "just," "simply," "as you can see").
- No pleasantries ("certainly!", "great question!", "happy to help").
- Short paragraphs. Bulleted lists for ≥3 items.
- Cite sources with markdown links when referencing external info.

**Example (good):**
> Zustand is the library that remembers which vehicles you added to the compare tray. Before this change, the list lived only in memory — if you reloaded the page, it disappeared. Now it saves to localStorage (the browser's small persistent-storage area), so the tray survives reloads.

**Example (bad — too jargon-dense for first-time coder):**
> Migrated useAppStore to Zustand's persist middleware with localStorage as the driver and v1 schema migration.

## Voice 2 — caveman (everything not in Voice 1)

**Where:** git commit messages, `LEARNINGS.md` mechanical auto-appended entries, `AUTONOMOUS_PLAN.md` queue item notes, seed.json `notes` fields, script output (`validate.py`, `metrics.py`, `smoke.sh`), `.auto-memory/*.md` content, queue descriptions, **chat replies to Ian (end-of-turn summaries, status updates between tool calls, short answers)**, `CLAUDE.md`, `SESSION_SUMMARY.md`, `PROJECT_PLAN.md`.

**Rules:**
- Drop articles (a, an, the) where meaning stays clear.
- Drop pleasantries and hedging.
- Fragments fine; sentences fine too.
- Keep technical terms, file paths, identifiers, and code blocks **exact**. Never abbreviate `scripts/milestone.py` to `mp.py` or `CitedValue` to `CV`.
- Keep URLs, error messages, and stack traces verbatim.
- Bullet-heavy; short lines.

**Example (good):**
```
fix B-01. zustand persist middleware. localStorage key 'ev-store' v1. persisted keys: compareIds filters tempC preconditioned hvacOn electricityRate. migrate on load. tray survives reload. chrome-mcp verified 3 vehicles.
```

**Example (bad — unnecessary polish for an internal commit):**
```
Fixed the compare-tray persistence bug by adding Zustand's persist middleware pointing to localStorage. Verified the fix works by using Claude-in-Chrome to add three vehicles, reload, and confirm they survive.
```

## Why two voices

- **Plain English respects the reader.** Ian is learning; his mom is the actual end-user; future Claude sessions benefit from orientation.
- **Caveman saves tokens** (~14–25% output reduction, ~25–39% session cost with prompt caching) on artifacts that don't need polish.
- **Mixing them confuses.** A commit full of pleasantries wastes tokens; a spec written in caveman wastes Ian's time.

## Drift detection

`scripts/self_audit.py` runs every 5 milestones and keyword-scans for:

- Caveman-style fragments leaking into user-facing files (e.g., a `CLAUDE.md` section starting with `fix:` or using bare fragments where sentences belong).
- Pleasantries/filler leaking into internal artifacts (e.g., a commit message starting with "Certainly!" or a LEARNINGS entry with "I'm excited to share…").

Drift flagged in LEARNINGS as a self-audit finding; fix on next touch of the file.
