# Canadian Hyundai/Kia EV Deal Research Pipeline

Staging folder for the Canadian Hyundai/Kia EV Google Sheet workflow.

Current operating rule:
- Stage research, QA counts, blocked sources, and pending sheet edits locally first.
- Push consolidated workbook edits in one Google Sheets batch update.
- Final `INVENTORY` rows require public dealer/OEM VIN, dealer, listing URL, visible price, and MSRP/fee evidence.
- Sold, no-VIN, inaccessible, country-mismatch, or aggregator-only leads go to `REJECTED_ROWS`.

Active workbook:
https://docs.google.com/spreadsheets/d/1jOIAm3ojHW4X_OU-T4drmPsXtpUgtIY04bDP1pr6-mU/edit

Local artifacts:
- `outputs/qa_counts.tsv`: workbook row counts plus UNKNOWN/PENDING readback.
- `outputs/blocked_sources.tsv`: current blockers and why they are not final sources.
- `outputs/tool_option_benchmark_results.tsv`: local benchmark results for native fetch, Firecrawl, and vPIC.
- `outputs/tool_decision.md`: current extraction strategy based on benchmark results.
- `staging/inventory_candidates.tsv`: staged VIN-backed inventory rows not yet pushed.
- `staging/price_history_candidates.tsv`: staged price history rows not yet pushed.
- `staging/bankstreet_inventory_candidates.tsv`: Bank Street Kia EV9 rows from one public list-page extraction.
- `staging/all_inventory_candidates.tsv`: combined staged inventory candidates for the eventual large Sheet batch.
- `staging/all_price_history_candidates.tsv`: combined staged price history candidates for the eventual large Sheet batch.
- `staging/all_rejected_candidates.tsv`: combined staged rejected rows for the eventual large Sheet batch.
- `staging/pending_updates.tsv`: staged cleanup edits for the next single Sheets push.
- `staging/final_sheet_batch_plan.tsv`: planned final Google Sheets batch sections.
