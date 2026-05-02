# DATA_CONTRACT.md

## Active Product Contract

The app is now a Hyundai/Kia buyer-side negotiation dashboard for new 2025 and 2026 electrified vehicles.

In scope:
- Makes: Hyundai, Kia.
- Years: 2025, 2026.
- Powertrains: BEV, PHEV, HEV.
- Listing condition: new by default; demo mileage can remain if dealer represents it as new.
- Geography: configured postal-code center with 100 km and 150 km modes, plus Ontario and national modes.

Out of scope by default:
- Gas-only vehicles.
- Used listings.
- CRM/contact-pipeline features.
- Invented finance estimates.

## Strict Research Import Columns

Deep Research imports must provide these columns:

`make,model,trim,year,powertrain,dealer,city,province,advertised_price_cad,msrp_cad,stock_or_vin,status,odometer_km,source_url,source_type,observed_date,incentive_discount_notes,finance_offer_notes,confidence_note`

Required fields:
- `make`
- `model`
- `trim`
- `year`
- `powertrain`
- `dealer`
- `city`
- `province`
- `advertised_price_cad`
- `source_url`
- `source_type`

Validation defaults:
- Reject non-Hyundai/Kia rows.
- Reject years outside 2025-2026.
- Reject rows without `http(s)` source URLs.
- Treat marketplace rows as lower-confidence leverage until direct dealer/OEM proof confirms the same stock.

## Leverage Score

Default ranking uses these components:
- 30% dealer weakness: 2025 leftovers, demo mileage, stale listings, duplicate same-trim stock, in-stock status.
- 25% discount gap: advertised price and discount versus MSRP and same-trim median.
- 20% supply pressure: same-trim alternatives and competing dealers.
- 15% incentives: imported incentives, OEM/dealer discounts, dealer-attached finance offers.
- 10% evidence quality: direct dealer/OEM evidence, confidence, freshness.

Finance rule:
- Finance is dealer-offer only. Do not compute or display invented monthly payments.
