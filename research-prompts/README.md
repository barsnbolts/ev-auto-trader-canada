# Research prompts

These markdown files are copy-paste-ready briefs for ChatGPT, Gemini, or Claude
running a deep-research / web-search pass. Each one targets one slice of the
data model and asks for **strict JSON** that drops directly into the matching
file under `/data/`.

## Workflow

1. Open the prompt file you want to refresh.
2. Copy the entire contents into ChatGPT (with Browse / Deep Research enabled)
   or Gemini (with Search Grounding enabled).
3. Paste the JSON block back; this repo's owner / agent will validate against
   the schema in `src/lib/types.ts` and merge into the relevant `/data/*.json`.
4. After merging, run `npm run snapshot` to capture a historical snapshot.

## Files

| File | Refreshes | Schema in repo |
| --- | --- | --- |
| `01-inventory-gta.md` | `data/units.json` (GTA + Greater Golden Horseshoe units) | `InventoryUnitSchema` |
| `02-inventory-canada.md` | `data/units.json` (rest of Canada) | `InventoryUnitSchema` |
| `03-incentives.md` | `data/incentives.json` (federal + all provincial + manufacturer + finance/lease + charger) | `IncentiveSchema` |
| `04-dealers.md` | `data/dealers.json` (full Kia + Hyundai dealer list) | `DealerSchema` |
| `05-specs-and-trims.md` | reference data baked into `src/lib/constants.ts` (only re-run on model-year changes) | n/a |

## Tips for higher-quality research

- Always pass the current `lastVerified` dates — tell the AI to mark anything
  it cannot independently confirm as `"VERIFY: <reason>"` in the `source` field.
- Ask for ISO dates (`YYYY-MM-DD`) and CAD numeric values without symbols.
- Pin both Kia.ca and Hyundai Canada **inventory pages** as authoritative.
- Pin the federal Transport Canada iZEV page for federal program status.
- Provincial sources: each province's energy/sustainability ministry — see the
  source URLs already in `data/incentives.json` for the canonical list.
