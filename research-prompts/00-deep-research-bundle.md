# Prompt — Deep Research mega-bundle (single-shot)

> Designed for ChatGPT Deep Research (or Gemini Deep Research). One paste.
> Returns one JSON object covering dealers, specs, market intel, taxes/fees,
> incentive deltas, and a GGH-priority inventory snapshot. Then ask the
> assistant in a follow-up turn to save the JSON as a downloadable file.
>
> Today's reference date: **2026-05-01**.

---

## Persona

You are a senior Canadian EV-market intelligence analyst working for a private
buyer who is shopping for a new Kia EV6, Hyundai Ioniq 5, or Hyundai Ioniq 6
(model years 2024, 2025, 2026 — including EV6 GT and Ioniq 5 N variants). The
buyer is based in the Greater Toronto Area and will likely transact at a
Greater Golden Horseshoe (GGH) Ontario dealer, but will travel within Ontario
or to a neighbouring province if the deal is materially better.

The deliverable is a structured intelligence dossier that powers a personal
inventory-tracking and deal-scoring website. Every field is consumed by code,
so structural correctness matters more than narrative.

## Master rules (apply to every section)

1. **Primary sources only.** OEM websites, dealer-owned websites, government /
   regulatory websites, official press releases. **Do not** use AutoTrader,
   CarGurus, Reddit, news aggregators, EV blogs, or YouTube.
2. **Canadian data only.** Reject US specs, US pricing, US incentives.
3. **As-of 2026-05-01.** If a source is older than 90 days for a volatile
   field (price, incentive, inventory), flag it.
4. **No hallucinated VINs, no hallucinated stock numbers, no hallucinated
   phone numbers.** If you cannot verify, omit the field — do not invent.
5. **Use the `VERIFY:` prefix** in any string field where you could not
   confirm a value from a primary source. Example:
   `"notes": "VERIFY: freight amount estimated from prior MY"`.
6. **Inline citations.** For every non-trivial fact (price, range, incentive
   amount, dealer existence) include the source URL inline within the
   `source` or `notes` field of that record.
7. **Output one JSON object** with the exact top-level keys defined below.
   No prose before or after. No markdown fences. Pure JSON.
8. **Omit unknown optional fields** rather than writing `null`.
9. Numeric fields: no `$`, no commas, no units in the value.
10. Dates: `YYYY-MM-DD` ISO format.

## Output skeleton

```json
{
  "generatedAt": "2026-05-01",
  "dealers": [ ... ],
  "specs": [ ... ],
  "incentivesDelta": [ ... ],
  "taxesAndFees": { ... },
  "marketIntel": { ... },
  "inventory": [ ... ],
  "_meta": {
    "sourceCount": 0,
    "sectionsWithVerifyFlags": [],
    "knownGaps": []
  }
}
```

---

## Section A — `dealers` (full Canadian Kia + Hyundai network)

**Goal:** canonical list of every authorized Kia and Hyundai new-vehicle
dealer in Canada. Coverage priority:

1. **Greater Golden Horseshoe** (Toronto, Mississauga, Brampton, Vaughan,
   Markham, Richmond Hill, Pickering, Ajax, Whitby, Oshawa, Oakville,
   Burlington, Hamilton, St. Catharines, Niagara Falls, Welland, Kitchener,
   Waterloo, Cambridge, Guelph, Milton, Newmarket, Aurora, Barrie) —
   **must be 100% complete**.
2. **Major Canadian metros** (Ottawa, Montreal, Quebec City, Vancouver,
   Surrey, Burnaby, Richmond BC, Calgary, Edmonton, Winnipeg, Halifax,
   Saskatoon, Regina, Victoria) — must be 100% complete.
3. **Rest of Canada** — best-effort completeness from the official locators.

**Sources (in this priority order):**
- `https://www.kia.ca/en/dealer-locator`
- `https://www.hyundaicanada.com/en/find-a-dealer`
- Each dealer's own website (for inventory URL, lat/lng confirmation)

**Per-dealer schema:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Slug: `<brand-lower>-<city-shortname>`. Disambiguate same-city duplicates with a street/area suffix (`hyundai-mississauga-dixie`). Stable, lowercase, ASCII only. |
| `brand` | `"Kia"` \| `"Hyundai"` | |
| `name` | string | Official trade name as on storefront / locator |
| `address` | string | Street address only |
| `city` | string | |
| `province` | enum | `ON` `QC` `BC` `AB` `MB` `SK` `NS` `NB` `NL` `PE` `YT` `NT` `NU` |
| `postal` | string | `A1A 1A1` format |
| `phone` | string | `XXX-XXX-XXXX` format |
| `lat` | number | 5 decimal places |
| `lng` | number | 5 decimal places |
| `inventoryUrl` | string | Direct URL to **new** inventory listing — not the homepage |

**Rules for Section A:**
- Sort by `province`, then `city`, then `brand`.
- If the locator returns a dealer but their site is dead, include them but
  set `inventoryUrl` to `"VERIFY: site unreachable 2026-05"`.
- Do not include used-only or service-only locations.

---

## Section B — `specs` (trim catalog for EV6, Ioniq 5, Ioniq 6, MY 2024–2026)

**Goal:** every Canadian-market trim × model-year × drivetrain combination
that was officially sold or is currently sold.

**Sources (in priority):**
- `https://www.kia.ca/en/electric/ev6` (and the configurator)
- `https://www.hyundaicanada.com/en/showroom/2026/ioniq-5` (substitute MY)
- Hyundai Canada Ioniq 6 showroom page
- Manufacturer press releases for launch MSRP

**Models in scope:**
- Kia EV6 (incl. EV6 GT) — MY 2024, 2025, 2026
- Hyundai Ioniq 5 (incl. Ioniq 5 N) — MY 2024, 2025, 2026
- Hyundai Ioniq 6 — MY 2024, 2025, 2026

**Per-trim schema:**

| Field | Type | Notes |
|---|---|---|
| `model` | `"EV6"` \| `"Ioniq5"` \| `"Ioniq6"` | |
| `year` | 2024 \| 2025 \| 2026 | |
| `trim` | string | Exact name as on the Canadian configurator |
| `drivetrain` | `"RWD"` \| `"AWD"` | |
| `motorKw` | number | Combined kilowatts |
| `motorHp` | number | Combined horsepower (kW × 1.341) |
| `batteryKwh` | number | Usable kWh |
| `rangeKm` | number | NRCan-cycle preferred, EPA acceptable — note which in `notes` |
| `dcFastChargeKw` | number | Peak DC FC speed |
| `acChargeKw` | number | Onboard charger rating |
| `zeroToHundredSec` | number | OEM-claimed |
| `cargoLitres` | number | Rear cargo seats up |
| `seats` | number | |
| `weightKg` | number | Curb weight |
| `msrpCad` | number | Base MSRP at launch |
| `freightPdiCad` | number | Freight + PDI |
| `notes` | string | V2L, heat pump, glass roof, packages, anything trim-specific |
| `colorsExterior` | string[] | Available exterior colors for that trim/MY |
| `colorsInterior` | string[] | Available interior colors |
| `source` | string | Configurator URL |

**Rules for Section B:**
- Round range to whole km, weight to whole kg, prices to whole CAD.
- If a trim was discontinued mid-cycle (e.g. EV6 Land trim dropped for 2025),
  still include the year it was sold.
- Include EV6 GT and Ioniq 5 N as separate trim entries.
- Note any MY-skipped trims (e.g. some Ioniq 6 trims were not offered in 2024).

---

## Section C — `incentivesDelta` (changes since 2026-05-01 baseline)

**Goal:** verify whether anything in the existing incentive baseline has
changed in the last 30 days, and surface any *new* programs.

**Sources:**
- Federal: `https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles`
- iZEV / EVAP transition page on Transport Canada
- Provincial program pages (BC: goelectricbc.gov.bc.ca; QC: vehiculeselectriques.gouv.qc.ca; NB: nbpower.com; NS: efficiencyns.ca; NL: takechargenl.ca; PE: princeedwardisland.ca; YT: yukon.ca/en/good-energy; MB: efficiencymb.ca)
- OEM promo pages: `https://www.kia.ca/en/promotions`, `https://www.hyundaicanada.com/en/special-offers`

**Per-delta schema:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable id matching baseline (e.g. `fed-evap-2026`, `qc-roulez-vert-2026`, `oem-kia-ev6-cash-2026-05`) |
| `changeType` | `"new"` \| `"changed"` \| `"ended"` \| `"unchanged-confirmed"` | |
| `scope` | enum | `federal` \| `provincial` \| `manufacturer_cash` \| `loyalty` \| `conquest` \| `lease_promo` \| `finance_promo` \| `charger_install` |
| `name` | string | |
| `appliesTo.models` | string[] | optional |
| `appliesTo.provinces` | string[] | optional |
| `amountCad` | number | optional |
| `aprPercent` | number | optional |
| `termMonths` | number | optional |
| `residualPercent` | number | optional |
| `monthlyPaymentExample` | number | optional |
| `downPaymentExample` | number | optional |
| `status` | `"active"` \| `"paused"` \| `"ended"` \| `"upcoming"` | |
| `effectiveFrom` | string | ISO |
| `effectiveUntil` | string | ISO |
| `stackableWith` | string[] | optional |
| `source` | string | URL or `VERIFY: ...` |
| `notes` | string | Eligibility caveats |
| `lastVerified` | string | `2026-05-01` |

**Rules for Section C:**
- Confirm explicitly whether iZEV remains ended and EVAP remains active.
- Confirm the Quebec Roulez vert step-down schedule — what is the current
  amount as of 2026-05?
- For OEM lease/finance promos: as-of-month must be **May 2026**.

---

## Section D — `taxesAndFees`

**Goal:** verified per-province sales-tax structure plus Ontario dealer fees.
Critical for OTD math.

**Output schema:**

```json
{
  "salesTaxByProvince": {
    "ON": { "type": "HST", "ratePercent": 13, "appliesToFreight": true, "appliesToAcExciseTax": true, "source": "..." },
    "QC": { "type": "GST+QST", "gstPercent": 5, "qstPercent": 9.975, "appliesToFreight": true, "source": "..." },
    "BC": { "type": "GST+PST", "gstPercent": 5, "pstPercent": 7, "luxurySurchargeOver55k": "...", "luxurySurchargeOver150k": "...", "source": "..." },
    "AB": { "type": "GST", "ratePercent": 5, "source": "..." },
    "...": "..."
  },
  "ontarioDealerFees": {
    "acExciseTaxCad": 100,
    "rdprmCad": null,
    "omvicCad": 12.50,
    "tireStewardshipCad": 16.20,
    "govLicensingCad": 80,
    "notes": "...",
    "source": "..."
  },
  "quebecLuxuryTax": {
    "thresholdCad": null,
    "ratePercent": null,
    "source": "..."
  },
  "federalLuxuryTax": {
    "thresholdCad": 100000,
    "rateRule": "lesser of 10% of total or 20% over threshold",
    "appliesToEvs": true,
    "source": "..."
  }
}
```

**Rules for Section D:**
- Confirm Ontario AC excise tax is still $100 flat (not removed).
- Confirm OMVIC fee — has it changed from $12.50 lately?
- Tire stewardship: is the per-vehicle rate still $16.20, or has it changed?
- RDPRM: this is QC, not ON. If you see it listed for ON deals, flag it.
- Confirm BC luxury surcharge bands ($55k → 8%, $150k → 20%) are current.
- Confirm whether the federal luxury tax (Select Luxury Items Tax Act)
  applies to EVs in 2026.

---

## Section E — `marketIntel`

**Goal:** negotiation-relevant context the buyer cannot get from spec sheets.

**Output schema:**

```json
{
  "discountNorms": [
    {
      "model": "EV6",
      "trim": "GT-Line AWD",
      "year": 2025,
      "typicalDiscountPercent": 4,
      "maxObservedDiscountPercent": 8,
      "context": "Aging MY25 inventory after MY26 launch; expect more flex on units >90 days on lot.",
      "source": "..."
    }
  ],
  "allocationStatus": [
    {
      "model": "Ioniq5",
      "trim": "Limited AWD",
      "year": 2026,
      "status": "constrained" | "balanced" | "oversupply",
      "estimatedWaitWeeks": 6,
      "notes": "...",
      "source": "..."
    }
  ],
  "knownIssues": [
    {
      "model": "EV6",
      "yearRange": "2022-2024",
      "issue": "ICCU failure recall (Kia recall 24V-...)",
      "severity": "high" | "medium" | "low",
      "resolution": "Replaced under recall; verify VIN status",
      "source": "..."
    }
  ],
  "competingEvOtdReference": [
    {
      "make": "Tesla",
      "model": "Model Y Long Range AWD",
      "year": 2026,
      "msrpCad": null,
      "estimatedOtdOntarioCad": null,
      "source": "..."
    },
    { "make": "Polestar", "model": "2 Long Range Single Motor", "year": 2026, "...": "..." },
    { "make": "Ford", "model": "Mustang Mach-E Premium AWD", "year": 2026, "...": "..." },
    { "make": "Volkswagen", "model": "ID.4 Pro S AWD", "year": 2026, "...": "..." },
    { "make": "Genesis", "model": "GV60 Performance", "year": 2026, "...": "..." },
    { "make": "Chevrolet", "model": "Equinox EV 2LT AWD", "year": 2026, "...": "..." }
  ],
  "endOfMonthSignal": "Describe whether May 2026 has factory bonuses, dealer stair-step bonuses, or stock-clear pressure that the buyer should time around. Cite OEM promo page expiry dates.",
  "warrantyTerms": {
    "kiaBatteryYears": 8,
    "kiaBatteryKm": 160000,
    "hyundaiBatteryYears": 8,
    "hyundaiBatteryKm": 160000,
    "kiaBumperYears": 5,
    "hyundaiBumperYears": 5,
    "source": "..."
  }
}
```

**Rules for Section E:**
- For `discountNorms`, give an honest estimated range — this is the section
  most likely to require `VERIFY:` flags. Better an honest "VERIFY: based on
  late-2025 reporting" than a confident fabrication.
- For `competingEvOtdReference`, OTD is for ON HST 13% on a base trim. Use
  this as a sanity check, not a source of truth.
- `knownIssues` should include current (2024–2026) recalls and TSBs that a
  buyer should ask the dealer to confirm cleared by VIN.

---

## Section F — `inventory` (GGH-priority snapshot, capped)

**Goal:** a current snapshot of new EV6 / Ioniq 5 / Ioniq 6 units listed at
Canadian dealers, prioritized by region. **Cap at ~250 units total** to
keep the report manageable. Allocate the cap as:

- **150 units** in the Greater Golden Horseshoe (priority)
- **50 units** elsewhere in Ontario
- **30 units** in Quebec + BC + AB combined
- **20 units** rest of Canada

Within each region, prioritize:
1. Aging units (>90 days on lot) — these are the highest-leverage targets
2. Discounted units (asking < MSRP)
3. Demo / loaner units
4. Outgoing model years (2024, 2025) before in-year (2026)

**Per-unit schema:**

| Field | Type | Notes |
|---|---|---|
| `id` | string | `u-001`, `u-002`, ... sequential |
| `vin` | string | 17-char VIN if shown — **do not fabricate** |
| `stockNumber` | string | Dealer's own |
| `model` | enum | `EV6` \| `Ioniq5` \| `Ioniq6` |
| `year` | enum | 2024 \| 2025 \| 2026 |
| `trim` | string | Must match a trim in Section B |
| `drivetrain` | `"RWD"` \| `"AWD"` | |
| `exteriorColor` | string | |
| `interiorColor` | string | |
| `msrp` | number | Base MSRP |
| `freightPdi` | number | Kia ~1995, Hyundai ~2095 — confirm per listing |
| `dealerAskingPrice` | number | Listed price |
| `status` | enum | `in_stock` \| `in_transit` \| `demo` \| `loaner` \| `sold_pending` |
| `daysOnLot` | number | Days since first listed; omit if unknown |
| `firstSeen` | string | ISO; if unknown, set to `lastSeen` |
| `lastSeen` | string | `2026-05-01` |
| `dealerId` | string | Must match an `id` from Section A |
| `listingUrl` | string | Direct URL to the listing |
| `isDemo` | boolean | |
| `demoKm` | number | If demo |
| `notes` | string | Packages, options, `VERIFY:` flags |

**Rules for Section F:**
- Visit each dealer's actual inventory page. Skip aggregator sites.
- If a unit's `dealerId` doesn't yet exist in Section A, **add the dealer
  to Section A first** so the foreign key resolves.
- Skip used vehicles. New only.
- If `daysOnLot` is unknown, omit it (do not estimate).
- Sequential `u-XXX` ids across all 250 units.

---

## Section G — `_meta`

After the substantive sections, populate:

```json
{
  "sourceCount": <integer count of distinct primary-source URLs cited>,
  "sectionsWithVerifyFlags": ["dealers.inventoryUrl", "marketIntel.discountNorms"],
  "knownGaps": [
    "Could not confirm Ioniq 6 N MY26 Canadian launch date",
    "BC luxury surcharge over-150k band — page returned 404, used Aug 2025 archived version"
  ],
  "elapsedResearchMinutes": <integer>
}
```

---

## DO-NOT list (common Deep Research failure modes)

1. ❌ Do not narrate. The output is JSON only. No "Here is the data:".
2. ❌ Do not wrap output in markdown code fences when delivering the final JSON.
3. ❌ Do not invent VINs, stock numbers, phone numbers, lat/lng, or postal codes.
4. ❌ Do not use AutoTrader, CarGurus, Kijiji, EV-database.org, fueleconomy.gov,
      or US-based EV comparison sites.
5. ❌ Do not repeat US specs as Canadian. Range, MSRP, freight, and trim names
      all differ.
6. ❌ Do not skip the `VERIFY:` flag when a value is uncertain. Honesty here is
      the single most important quality signal.
7. ❌ Do not collapse multiple model-year trims into one row. Each MY × trim ×
      drivetrain is its own row in `specs`.
8. ❌ Do not exceed the inventory cap. 250 units total, regionally allocated.

## How to deliver

1. First message: the complete JSON object as plain text (no fences).
2. If the JSON exceeds the message length, split across messages with
   continuation markers `// CONT_1`, `// CONT_2` and a final `// END`.
3. After the JSON is delivered, when I ask, save the consolidated JSON as
   a downloadable `.json` file via Code Interpreter.

Begin research now. Target effort: maximize coverage over speed — this is a
single-shot bundle, not iterative.
