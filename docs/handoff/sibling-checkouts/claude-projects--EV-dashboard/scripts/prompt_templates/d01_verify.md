# Prompt template — D-01 verify

**Purpose:** verify vehicle spec fields against independent web sources via Exa.

**Current version: v1.1** (2026-04-23)

**History:**
- v1 — initial pilot (5 vehicles × 3 fields). Worked well. Minor issue: one unit mismatch (mi vs km) crept through.
- v1.1 — D-01-ext ran this. Added special-case for Model Y Juniper; added `proposed_value` to schema; reminded subagent that MSRPs stay Low.
- v2 (planned) — require dual-unit citation (both mi and km) on every range finding; add sibling-consistency check (RWD/AWD should share battery/chemistry).

## Template body

```
You are running the D-01 verification pass for the EV Dashboard project.

## Scope
Verify {N} fields ({FIELDS}) for these {M} vehicle IDs in seed.json:
{VEHICLES}

## Method
1. Load Exa tools.
2. For each pair, one Exa web_search_exa query scoped to canonical domains.
3. Read snippets; fetch only if ambiguous.
4. Compare to seed value. Classify.

## Confidence promotion rules
- AGREES (≥2 independent sources within ±5%) → High
- AGREES_BUT_SPARSE (1 strong source) → Medium with citation
- DISAGREES → Medium with disagreement note + proposed_value
- NO_DATA → no change

## Special cases
- {PER_RUN_SPECIAL_CASES, e.g., "Tesla Model Y Juniper — NA specs emerging; if Exa has useful US data, propose Medium with Canadian-availability caveat"}
- For PHEVs: dc_charge_kw_max = 0 is legit.
- MSRPs always stay Low (pricing decays).

## Output schema
{JSON SCHEMA BLOCK — see logs/subagent_runs/*.json for current version}

## Guardrails
- Token budget under {N}.
- No modifications to seed.json directly.
- All source URLs real (no fabrication).
- Every range finding MUST include both mi and km if source cites imperial.
- If stopping early, reflect in summary.pairs_total.
```

## Proven anti-patterns to avoid
- Asking the subagent to modify seed.json itself → harder to audit
- Broad "verify everything" scope → returns shallow data. Always give specific fields.
- No special-case guidance → subagent struggles with genuinely-uncertain vehicles

## Response style (caveman — applies to subagent output)

Subagent should respond caveman-concise:
- Drop articles and pleasantries. Fragments fine. Technical terms exact.
- No preamble. No "sure, I'll do that." Just the JSON + a ≤150-word meta.
- Pattern: [finding] [evidence] [action]. Next.

Saves 14–21% output tokens with zero quality loss on structured tasks.
