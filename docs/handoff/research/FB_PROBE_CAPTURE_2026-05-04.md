# Facebook Marketplace probe · F2 capture · 2026-05-04 evening

## Headline (forces a re-decision)

**Chrome MCP JS-execution on facebook.com is permission-gated.** Every
`mcp__Claude_in_Chrome__javascript_tool` call against FB returns
`permission_required: www.facebook.com`. The capture-hook approach
(install monkey-patch on `window.fetch` + `XMLHttpRequest` → trigger
GraphQL XHR → dump `window.__captured`) is therefore blocked.

Navigation works. `find` (DOM accessibility-tree extraction) works.
Only direct JS execution is blocked — and the GraphQL probe pattern
needs JS execution to install the capture hook.

**Implication:** the "Chrome MCP probe → Python `requests.post()` GraphQL
replay" pattern from the FB strategy doc is NOT viable as written.
Three honest alternatives remain (see below).

## What worked in this probe

- **Pairing**: ✓ (Browser 1, Ian's session, `c_user=` cookie present
  → Ian is logged in to FB).
- **Navigation**: ✓ (`/marketplace/category/vehicles?query=kia%20ev6`
  loaded fine, `(13) Facebook Marketplace | Facebook` title rendered).
- **`find`-based DOM extraction**: ✓. 20 vehicle listings returned
  per page, format:

  ```
  ref_990: link "2019 Porsche Cayenne, CA$41,999, Toronto, ON,
                 listing 2199966374163784"
  ```

  Captures: year, make, model, price, city, province, FB listing ID.

- **Search query honored?**: PARTIAL. URL had `?query=kia%20ev6` but
  results page showed mixed-brand vehicles. Either query param ignored
  OR was redirected to home feed by FB's UI. Unclear — needs follow-up
  with a different URL pattern (e.g.
  `/marketplace/search/?query=kia+ev6`).

## What didn't work

- **JS execution** (`window.__captured`, `window.fetch` monkey-patch,
  `JSON.parse(__NEXT_DATA__)`): ALL blocked by per-domain permission.
- **Therefore: GraphQL XHR capture impossible** via current
  Chrome MCP tooling.

## Three honest alternatives for FB Marketplace

### Option A — Apify actor (paid, recommended fallback)

`apify/facebook-marketplace-scraper` (official, updated 2026-05-05,
99.2 % success per R1). ~$5-6/1k listings. At projected weekly
volume (~300 listings × 4 = ~1200/mo): ~$6-7/mo.

**Pros**: works today. Maintained. Handles persistedQuery rotations.
No infra burden on Ian's Mac.

**Cons**: paid. User said "free direction for scraping" — this is
the Apify path the user wants to avoid as primary.

### Option B — Chrome-MCP-driven scrape at runtime (free, complex)

Use `find` repeatedly to enumerate listings page-by-page:

```python
# Pseudo-code — requires Chrome MCP available during cron
for query in ["kia ev6", "hyundai ioniq 5", ...]:
    chrome_mcp.navigate(url=fb_search_url(query))
    chrome_mcp.wait(5)
    while True:
        cards = chrome_mcp.find("vehicle listing card")  # 20 per page
        for card in cards:
            extract_via_label_regex(card)
        chrome_mcp.scroll(down=10)  # trigger infinite-scroll pagination
        chrome_mcp.wait(3)
        if no_new_cards():
            break
```

**Pros**: $0/mo. Uses Ian's existing FB session.

**Cons**:
- Requires Chrome MCP available at cron time (Ian's Mac powered on,
  Chrome open, extension paired, MCP server running — same infra as
  Claude Code). Daily cron at 7 am won't have these unless Ian is
  awake.
- Way slower than HTTP scrape (~2 min/page × ~20 pages = ~40 min/sweep).
- Limited fields: no VIN (private sellers don't expose anyway), no
  KMs, no description — just title + price + location + listing ID.

### Option C — Manual periodic refresh (free, low-tech)

Ian opens a `fb_marketplace_capture.html` page on his Mac that uses
`window.fetch` to log marketplace XHRs to localStorage. Click "Save"
when done → downloads `_facebook_raw.json`. Frequency: weekly,
self-driven. ~5 min Ian-time per refresh.

**Pros**: $0, no infra dependency, captures full GraphQL response
(including VIN if present, KMs, description).

**Cons**: Manual. User-friction. Forgettable.

### Option D — Defer FB entirely

Ship I0 (AT + Kijiji + Leasebusters + dealers + promos). Re-evaluate
FB after that's stable. FB Marketplace EVs are a smaller / sometimes-
duplicative source than AT — AT and Kijiji together cover ~95 % of
the dealer-level Hyundai/Kia EV inventory in Canada. FB's marginal
value is private-seller used cars below market, which is
narrower-but-real but lower volume.

## Recommendation (free-path-leaning)

**Defer FB to TIER I2 (bonus sources).** Reasoning:
- Free-path Option B (Chrome MCP runtime) needs Mac+Chrome+MCP at
  cron time — non-trivial infra.
- Free-path Option C (manual) is high user-friction for marginal
  value-add.
- Apify Option A works but is paid; user-OK gate.
- AT + Kijiji + dealers + promos give 95 %+ of inventory value
  without FB.

**When to revisit:**
- After I0 ships and stable. Re-check the JS-exec permission gate
  (Chrome MCP may add a per-session FB grant, or the user may grant
  it through the extension UI).
- If user explicitly wants FB sooner: ship Apify Option A as TIER I1
  (~$6-7/mo, well under cap).

## Updated FB_MARKETPLACE_DECISION

`docs/handoff/research/FB_MARKETPLACE_DECISION_2026-05-04.md` should
be patched in the same commit as this capture:
- Mark "Primary: Chrome MCP probe + Python replay" as **NOT VIABLE**
  (JS-exec permission-gated).
- Promote Option A (Apify) to "preferred when FB is wanted."
- Add Options B/C/D as alternatives.
- Move FB from TIER I1 to TIER I2 in the runway.

## Open question for the user

When you (Ian) want FB Marketplace data added:

1. **OK to spend ~$6-7/mo on Apify for FB?** (Option A — easiest)
2. **OR want me to explore Option B** (Chrome-MCP-runtime scrape;
   needs your Mac on at cron time)?
3. **OR Option C** (manual weekly capture page)?
4. **OR defer indefinitely** (skip FB)?

Recommend deferral until I0 ships and you can see whether AT+Kijiji
coverage is enough.
