# Tool Decision After Local Benchmark

Primary extraction path:
1. Web search only for discovery.
2. Native Node fetch against public Canadian dealer/OEM VDP.
3. Dealer-platform parser extracts VIN, MSRP, dealer price, fees, stock, status, trim, and source URL.
4. vPIC decode is QA only; it can validate make/year/check digit but often lacks Canadian model/trim detail.
5. Firecrawl is a fallback/cross-check for hard pages, not the default dealer VDP extractor.

Why:
- Native Node fetch succeeded on two active Canadian Hyundai IONIQ 5 dealer VDPs in under two seconds total and used no paid credits.
- Firecrawl was accurate on Pathway but mis-extracted Neddy's asking price even while its own evidence text showed the correct dealer price.
- Firecrawl remains useful for hard pages, PDFs, and messy official pages, but broad dealer crawling would burn credits quickly and can return noisy inventory cards.

Current accepted staged candidates:
- Pathway Hyundai 2026 Hyundai IONIQ 5 Preferred, VIN `KM8KNDDC5TU408198`, dealer price $61,013, MSRP $59,901.
- Neddy's North Bay Hyundai 2026 Hyundai IONIQ 5 Preferred, VIN `KM8KRDDC7TU382126`, dealer price $66,720, MSRP $65,899.
- Bank Street Kia yielded 11 in-stock 2026 Kia EV9 candidates from one public list page, with VIN, stock, trim, status, MSRP component, selling price, fee breakdown, colour, and per-vehicle detail URL.

Current rejected/needs-recheck samples:
- Neddy's IONIQ 9 URL now returns HTTP 404 to native fetch, so future Sheet data for that URL should be reverified before relying on it again.
- Orléans Kia EV6 listing remains rejected because it is sold and MSRP was not visible.
- Bank Street Kia 2025 EV6 Land AWD row is staged as rejected/recheck because status is Incoming Vehicle and no selling price was visible in the extracted list evidence.

Batch status:
- `staging/all_inventory_candidates.tsv` now contains 13 staged final-inventory candidates.
- `staging/all_price_history_candidates.tsv` now contains 13 staged price snapshots.
- Nothing from this continuation pass has been pushed to Google Drive/Sheets.
