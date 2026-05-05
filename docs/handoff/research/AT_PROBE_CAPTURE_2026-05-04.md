# AutoTrader.ca Chrome MCP probe · capture · 2026-05-04 evening

## Headline finding (overrides AT_STRATEGY_DECISION's ngVdpModel premise)

**AutoTrader.ca uses Next.js with all data in `__NEXT_DATA__`.**
The R1-survey + earlier strategy doc assumed
`window['ngVdpModel']` was the data target. **It does NOT exist on
either search-results pages OR detail pages.** The site has been
re-architected to standard Next.js SSR. All listing data is embedded
in the `<script id="__NEXT_DATA__">` JSON tag, server-rendered, no
JS execution required.

This is **dramatically better** than the ngVdpModel approach the R1
survey expected: one GET per page returns 20 listings inline.

## Probe environment

- Chrome MCP paired as Browser 1 (deviceId
  `b4894a51-95cd-4bea-8b91-5dab758daf08`).
- Tab `418377376`, fresh.
- No Imperva challenge encountered. Page loaded normally.

## Search-results page schema

URL pattern: `https://www.autotrader.ca/cars/{make}/{model-slug}/`

Example: `https://www.autotrader.ca/cars/hyundai/ioniq-5/?prx=100&prv=Ontario&loc=K1A%200B1`

Important: `loc=K1A 0B1` (Ottawa) was IGNORED. Page defaulted to
Mississauga (lat 43.572429, lon -79.759598). To force a specific
postal code or region, use the page's location-picker UI, then save
the resolved query string (which has `lat`/`lon`/`zip` set).

Important: `rcp=N` per-page param is IGNORED. Server hardcodes 20
results per page. Pagination via `?page=2`, etc.

### `__NEXT_DATA__.props.pageProps.listings[]` schema

20 entries per page (138 total for Ioniq 5 search → 7 pages).

Per-listing top-level keys:
```
id, evBanner, identifier, crossReferenceId, images, ocsImagesA,
externalCustomerId, price, seals, availableNow, superDeal, url,
vehicle, location, seller, appliedAdTier, adTier, isOcs,
specialConditions, statistics, searchResultType, searchResultSection,
tracking, vehicleDetails, wltpValues, trackingParameters,
dealBuilderUrlEN, dealBuilderUrlFR
```

**Critical fields (all confirmed present):**

| Field | Type | Sample |
|---|---|---|
| `id` | UUID | `"ddfbd1dd-5312-4e8f-b49b-a6d53e241076"` |
| `crossReferenceId` | string (numeric) | `"68259749"` (legacy AT id) |
| `url` | URL | `"https://www.autotrader.ca/offers/hyundai-ioniq-5-preferred-electric-grey-{uuid}"` |
| `price.priceFormatted` | string | `"$ 41,995"` (need parse) |
| `vehicle.modelYear` | int | `2023` |
| `vehicle.make` | string | `"Hyundai"` |
| `vehicle.model` | string | `"IONIQ 5"` |
| `vehicle.modelVersionInput` | string | `"Preferred"` (TRIM!) |
| `vehicle.mileageInKm` | string | `"39,053 km"` (need parse) |
| `vehicle.fuel` | string | `"Electric"` |
| `vehicle.transmission` | string | `"Automatic"` |
| `vehicle.offerType` | string | `"U"` (used) or `"N"` (new) |
| `location.city` | string | `"Mississauga"` |
| `location.provinceCode` | string | `"ON"` |
| `location.zip` | string | `"L5N1A4"` |
| `location.distanceToSearchLocationInKm` | int | `4` |
| `seller.id` | string | `"47943322"` |
| `seller.type` | string | `"Dealer"` (or "Private") |

**VIN is NOT present at search-results level.** Need to fetch detail
pages to get VIN. (Same was true on the old AT site per the audit.)

### Pagination

- `pageProps.numberOfResults`: total result count (138 for Ioniq 5)
- `pageProps.numberOfPages`: total pages (7 for Ioniq 5)
- URL pattern for page N: `?page=N` (untested in this probe but
  standard Next.js convention; test in F1-followup)

## Detail page schema

URL pattern: `https://www.autotrader.ca/offers/{vehicle-slug-with-uuid}`

`__NEXT_DATA__.props.pageProps.listingDetails` is a SUPERSET of the
search-results listing entry, with these added top-level keys:

```
id, searchResultType, isDeliverable, description, ratings, images,
headerImage, youtubeLink, twinnerUrl, threeSixty, prices, superDeal,
price, availability, financingFlags, vehicle, identifier, seals,
location, seller, whatsappNumber, webPage, externalCustomerId,
status, leasingDetails, warranty, warrantyExists, ocsInfo,
trackingParams, appliedAdTier, adTier, specialConditions,
adTargetingString, statistics, imgAltText, vehicleType,
dealBuilderUrlEN, dealBuilderUrlFR, articleType, isNew, dealBuilderFullUrl
```

### **VIN location (CONFIRMED)**

Two paths, same value:

```
.props.pageProps.listingDetails.vehicle.identifier.vin
.props.pageProps.listingDetails.vehicle.rawData.identifier.vin
```

Test sample: `KM8KN4AE6PU228532` (valid Hyundai VIN, KM8 prefix).

### `vehicle` subobject — full key list

```
licensePlate, carpassMileageUrl, makeId, modelOrModelLineId, make,
modelYear, model, modelGroup, variant, modelId, modelGroupIds,
modelGenerationId, modelVariantId, motorTypeId, trimLineId,
modelVersionInput, type, hsnTsn, mileageInKmRaw, mileageInKm,
bodyType, numberOfSeats, numberOfDoors, bodyColor, bodyColorRaw,
paintType, bodyColorOriginal, engineHours, identifier (= {vin: ...})
```

`mileageInKmRaw` is the numeric form (no thousand-separator).
`bodyColorRaw` likewise. Use these for parse, not the formatted
strings.

### Other useful fields on detail pages

- `description` — seller's free-text blurb.
- `images` — array of image URLs.
- `availability` — in-stock / pending status.
- `leasingDetails` — captured monthly payment if AT shows lease pricing.
- `warranty` + `warrantyExists` — remaining factory warranty info.
- `dealBuilderFullUrl` — link to AT's prequalification flow.

## Anti-bot posture observation

- **No Imperva challenge** during the probe sequence (4 page loads).
- **No CAPTCHA**, no rate-limit error.
- The site is plain Next.js SSR — much friendlier than the legacy
  Angular SPA the audit expected.

The R1 survey said "Imperva blocks bare requests within 3 calls" —
that may be true for fast-burst scraping, but our probe (4 page loads
with 6-8s waits) succeeded cleanly. **Free path is highly viable**
for our cadence (6 search queries × 7 pages + ~150 incremental detail
pages per day, all spaced 5-8s).

## Volume + cadence projection

**Per-sweep request budget (worst-case daily):**
- 6 search queries (Ioniq 5/6/9, EV6, EV9, Niro EV) × ~7 pages avg
  = 42 search-page GETs.
- ~150 detail-page GETs (VIN + full schema) for new/changed listings
  in the day. (Initial seed: ~800 detail-page GETs over a single
  one-time bootstrap run.)

At 5-8s sleep jitter per request, total sweep time:
- Daily: 42 + 150 = 192 GETs × ~6.5s avg = **~21 min/sweep**.
- Initial bootstrap: 42 + 800 = 842 GETs × ~6.5s = ~91 min.

Acceptable for daily cron at 7 am.

## Caching strategy (medium-tier I0e implementation)

After bootstrap:
1. Walk all 6 search-result queries, get current `crossReferenceId`
   set per query.
2. Diff against yesterday's set.
3. **New IDs**: detail-fetch immediately (full schema + VIN).
4. **Removed IDs**: mark as `availability: "removed"`,
   `removedAt: today` in `data/_autotrader_raw.json`.
5. **Persistent IDs**: skip detail fetch (use cached schema), bump
   `lastSeen` to today.

This drops per-day detail fetches from 800 to 50-150 typically.

## Replayer spec → `AT_REPLAY_SPEC_2026-05-04.md`

(Separate file. See spec for the I0e Python implementation.)

## What changed vs AT_STRATEGY_DECISION

The strategy doc said "build a `window['ngVdpModel']` regex parser."
Throw that away. Use a `__NEXT_DATA__` JSON parser instead — it's
cleaner (no regex), more robust (Next.js framework convention), and
gives us the same data with one fewer indirection layer.

`AT_STRATEGY_DECISION_2026-05-04.md` will be patched in the same
commit as this capture.
