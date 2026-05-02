# LOW_NEXT.md — fill-in tasks for low-reasoning / Sonnet sessions

**Read this when picking up on Sonnet or low-reasoning Opus.** Each task is
a pure mechanical fill-in: query a known source, paste an answer into a
known cell, save the file. No code edits, no architectural decisions.

If a row's answer isn't unambiguous from the OEM page, mark
`confidence: "Low"` and move on — never guess.

---

## L1. Fill data/heatpump-research-queue.json

20 rows, one per (model, year, trim, drivetrain) currently in `data/specs.json`.

For each row, fire one Exa call and paste the answer back into the row.
Template query:

```
mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa
  query: "<year> <model> <trim> Canada heat pump standard"

  example: "2025 Hyundai Ioniq 5 Limited AWD Canada heat pump standard"
```

Then `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa` on the
top OEM hit (hyundai.ca / kia.ca / EVDB / Hyundai/Kia spec sheet PDF).

Fill the row in `data/heatpump-research-queue.json`:

```json
{
  "model": "Ioniq5",
  "year": 2025,
  "trim": "Limited AWD",
  "drivetrain": "AWD",
  "hasHeatPump": true,                     // ← true | false | null (don't guess)
  "source": "https://www.hyundaicanada.com/...",  // ← URL the answer came from
  "accessed": "2026-05-02",                // ← today's date, ISO
  "confidence": "High",                    // ← "High" | "Medium" | "Low"
  "notes": ""                              // ← any caveats (e.g. "standard 2024+, optional pre-2024")
}
```

Confidence guide:
- **High** = OEM site or spec PDF says it explicitly
- **Medium** = third-party spec aggregator (EVDB, EV-database) says it
- **Low** = forum / review mention only, not corroborated

When done, run on the same machine:
```bash
python3 ~/ev-auto-trader-canada/scripts/merge_heatpump_research.py
```

That writes the answers into `data/specs.json`, after which the medium
queue picks up M7 (UI chip wire-up).

**Cost ceiling:** 20 Exa search + 20 Exa fetch = ~40 Exa calls. Cheap.

**If unblocked:** there's no "next L task" yet — surface back to the user.

---

## What NOT to do on low

- **Don't** edit `data/specs.json` directly. Use the queue + merge script.
- **Don't** guess `hasHeatPump: true` if the source is unclear — leave
  `null` and set `notes: "ambiguous, needs HIGH research"`.
- **Don't** add new rows to the queue file. If a (model, year, trim) is
  missing, that means it's not in `data/specs.json` and the medium-tier
  catalog work hasn't surfaced it yet.

---

## Reference

- Medium queue: `MEDIUM_NEXT.md`
- Schema for the answer: `src/lib/types.ts` `SpecSchema.hasHeatPump` etc.
- Merge script: `scripts/merge_heatpump_research.py`
- Queue regenerator (re-run after specs.json grows): `scripts/build_heatpump_queue.py`
