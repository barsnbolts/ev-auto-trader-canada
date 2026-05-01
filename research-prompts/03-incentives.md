# Prompt — Incentives, rebates, lease/finance promos refresh

## Persona

You are a Canadian EV-incentives researcher. Verify the **current** status and
amounts of every program below from official primary sources only. Do not use
news articles or third-party summaries — go to the government / OEM page.

## What to refresh

### Federal

1. **iZEV (Incentives for Zero-Emission Vehicles)**
   - Source: https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles/light-duty-zero-emission-vehicles/eligible-vehicles
   - Capture: status (`active`, `paused`, `ended`, `upcoming`), amount (CAD),
     `effectiveFrom`, `effectiveUntil`, eligibility caveats. As of writing the
     program is paused — confirm whether it has been reinstated.

2. **EVCi / federal home-charger grant**
   - Source: https://natural-resources.canada.ca/energy-efficiency/transportation-alternative-fuels/zero-emission-vehicle-infrastructure-program

### Provincial (capture all that exist)

| Province | Program | Authoritative source |
| --- | --- | --- |
| BC | CleanBC Go Electric | goelectricbc.gov.bc.ca |
| QC | Roulez vert | vehiculeselectriques.gouv.qc.ca |
| NB | NB Power EV Rebate | nbpower.com → save energy → EV rebate |
| NS | Electrify Rebate | efficiencyns.ca/electric-vehicles |
| NL | Take Charge | takechargenl.ca |
| PE | EV Incentive | princeedwardisland.ca → finance → EV incentive |
| YT | Good Energy | yukon.ca/en/good-energy |
| ON | (none currently — confirm) | — |
| AB, MB, SK, NT, NU | (none — confirm) | — |

### Manufacturer

Pull from the **current offers / promotions** pages:

- https://www.kia.ca/en/promotions
- https://www.hyundaicanada.com/en/special-offers

Capture, per model (EV6, Ioniq 5, Ioniq 6) and per trim group:

- `manufacturer_cash` — non-stackable cash discount, customer cash, EV bonus
- `loyalty` — current Kia/Hyundai owner bonus
- `conquest` — competitive owner bonus
- `lease_promo` — APR %, term (months), residual %, monthly payment example,
  down payment example
- `finance_promo` — APR %, term (months), monthly payment example, down

### Charger install rebates

- Save On Energy (Ontario) — saveonenergy.ca/For-Your-Home → EV charging
- Enbridge Smart Home Rebate — enbridgegas.com (verify EV charger eligibility)
- Federal EVCi (above)

## Output format — STRICT JSON

```json
[
  {
    "id": "fed-izev-2025",
    "scope": "federal",
    "name": "iZEV federal rebate",
    "appliesTo": { "models": ["EV6", "Ioniq5", "Ioniq6"] },
    "amountCad": 5000,
    "status": "paused",
    "effectiveFrom": "2019-05-01",
    "effectiveUntil": "2025-01-12",
    "source": "https://tc.canada.ca/...",
    "lastVerified": "2026-05-01",
    "stackableWith": []
  }
]
```

Rules:
- One JSON array. No prose.
- `scope` must be exactly one of: `federal`, `provincial`, `manufacturer_cash`,
  `loyalty`, `conquest`, `lease_promo`, `finance_promo`, `charger_install`.
- `status` must be one of: `active`, `paused`, `ended`, `upcoming`.
- For lease/finance: include `aprPercent`, `termMonths`,
  `monthlyPaymentExample`, `downPaymentExample`, and (lease only)
  `residualPercent`.
- For provincial programs: set `appliesTo.provinces` to the relevant
  two-letter codes.
- Include `lastVerified` as today's ISO date.
- Use `stackableWith` to declare which other programs can layer; the federal
  iZEV historically stacks with provincial programs.
- If you cannot verify a program from a primary source, set its `source` to
  `"VERIFY: <what you could not confirm>"` rather than guessing.

## Sanity checks before you submit

- iZEV — check whether it is currently paused, reinstated, or replaced. State
  this explicitly even if `amountCad` is unchanged.
- Quebec Roulez vert — schedule has step-downs over time. Capture the
  effective amount **as of today**.
- Manufacturer offers — change monthly. Always confirm the **as-of-month**
  matches the current calendar month.
