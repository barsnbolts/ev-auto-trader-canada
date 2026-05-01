# Prompt — Dealer registry refresh

## Persona

You are a Canadian dealer-network researcher. Build the canonical list of every
authorized Kia and Hyundai dealer in Canada that sells new vehicles, with a
priority on completeness for the Greater Golden Horseshoe and major
metropolitan areas (Vancouver, Calgary, Edmonton, Montreal, Quebec City,
Halifax, Winnipeg, Ottawa).

## Sources

- Kia Canada dealer locator: https://www.kia.ca/en/dealer-locator
- Hyundai Canada dealer locator: https://www.hyundaicanada.com/en/find-a-dealer

## Per-dealer fields

| Field | Notes |
| --- | --- |
| `id` | slug-style: `<brand>-<city-shortname>`. e.g. `kia-pickering`, `hyundai-mississauga`. Disambiguate same-city duplicates with a suffix (`hyundai-mississauga-dixie`) |
| `brand` | `Kia` or `Hyundai` |
| `name` | Official trade name (e.g. "Pickering Kia", "Erin Mills Hyundai") |
| `address` | Street address only |
| `city` | City name |
| `province` | Two-letter code: `ON`, `QC`, `BC`, `AB`, `MB`, `SK`, `NS`, `NB`, `NL`, `PE`, `YT`, `NT`, `NU` |
| `postal` | Canadian postal code if available |
| `phone` | National format `XXX-XXX-XXXX` |
| `lat` / `lng` | Decimal-degree coordinates (5 decimals enough). Use the locator's geocoded value if shown, otherwise geocode the address. |
| `inventoryUrl` | Direct URL to the dealer's new inventory listing page |

## Output format — STRICT JSON

```json
[
  {
    "id": "kia-pickering",
    "brand": "Kia",
    "name": "Pickering Kia",
    "address": "440 Kingston Rd",
    "city": "Pickering",
    "province": "ON",
    "postal": "L1V 0C2",
    "phone": "905-839-9777",
    "lat": 43.832,
    "lng": -79.099,
    "inventoryUrl": "https://www.pickeringkia.ca/inventory"
  }
]
```

Rules:
- One JSON array. No prose.
- Omit unknown optional fields rather than writing `null`.
- Sort by `province`, then `city`, then `brand`.
