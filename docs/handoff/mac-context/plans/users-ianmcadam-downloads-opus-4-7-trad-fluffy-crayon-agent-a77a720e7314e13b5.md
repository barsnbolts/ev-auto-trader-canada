# Alpaca Paper Trading Edge Cases — Research Report

Below is the report I'll deliver to the user. No code or system changes — pure research findings.

---

## Alpaca Paper Trading Edge Cases for an Autonomous Bot

### 1. Market holidays and half-days
Alpaca does **not** push errors when fired during a closed market — it just behaves normally with `is_open=false`. The bot must explicitly check `GET /v2/clock` (`is_open`, `next_open`, `next_close`) before acting. Order submission on a closed day returns 200 with the order **queued** at status `accepted` until next open; there's no automatic rejection. The clock endpoint correctly reports half-day closes (e.g., 1pm ET on Black Friday). If your bot fires at 8:30 and tries to place a market order, the order sits queued; when market opens at 9:30 (or 1pm half-day), it executes — possibly at a price you didn't plan for. Always gate on `clock.is_open`. Source: https://docs.alpaca.markets/reference/querymarketclock-1

### 2. Trading halts (LULD, news, circuit breakers)
Alpaca does not pre-validate halts on the order endpoint — orders to halted symbols are typically `accepted` and forwarded; rejection (if any) comes from the venue and surfaces asynchronously as `rejected` status with a reject reason. Quote data continues to flow but the bid/ask can go stale or zero (see #8). The bot must subscribe to trade-update streams and handle `order.status == "rejected"` reactively; there's no specific HTTP error code for "halted symbol." Sources: https://forum.alpaca.markets/t/rejected-orders/4495 and https://alpaca.markets/learn/how-to-fix-common-trading-api-errors-at-alpaca

### 3. Partial fills
Status transitions: `new` → `partially_filled` → `filled`. On `partially_filled`, the order's `filled_qty` updates incrementally. Bracket/OCO and "follow-on" trailing stops in Alpaca's complex-order constructs only activate on **full fill** of the parent. For your bot's pattern (manual trailing stop after entry), best practice is to wait for `status == "filled"` via the trade-updates websocket, not for `partially_filled`. If you must trail a partial, place the trailing stop with `qty = filled_qty` and update on subsequent fills — but this is fragile. Paper trading rarely produces partial fills (it usually fills 100% from a synthetic book), which is itself a gotcha: your code paths for partials won't get tested. Sources: https://docs.alpaca.markets/docs/orders-at-alpaca and https://forum.alpaca.markets/t/alpaca-paper-trading-partial-order-fill/2683

### 4. GTC order persistence
GTC orders (including trailing-stop GTC) are **auto-cancelled at 90 days** by Alpaca's aged-order policy. A daily 4:15pm ET job submits the cancel. Modifying (PATCH) the order resets the 90-day clock. Your bot should track `expires_at` and handle the cancel notification — don't assume "GTC = forever." Source: https://docs.alpaca.markets/docs/orders-at-alpaca (aged-order policy section).

### 5. Fractional shares
Yes — paper supports fractional. `{"qty":"0.5", ...}` works. Constraints: `time_in_force` must be `day`, supported on market/limit/stop/stop-limit. You can also pass `notional` (dollar amount) instead of `qty`. **No fractional support for trailing stops, GTC, or extended hours.** That's the trap: if your strategy buys 0.5 shares, you cannot attach a GTC trailing stop. Source: https://docs.alpaca.markets/docs/fractional-trading

### 6. Extended hours
Pre-market 4:00–9:30 ET, after-hours 4:00–8:00 ET (Mon–Fri). To trade extended, set `extended_hours=true` AND use `type=limit` AND `time_in_force=day`. **Market orders are rejected outside RTH** — this is a hard rule. Quotes during extended hours are available but thinner; the standard SIP feed covers extended hours. 24/5 overnight is a separate opt-in product (limit orders only). Sources: https://alpaca.markets/support/extended-hours-trading and https://docs.alpaca.markets/docs/245-trading

### 7. Stock splits / corporate actions
Alpaca processes splits in the beginning-of-day reconciliation: position `qty` and `avg_entry_price` are adjusted by the ratio. For a 2-for-1, qty doubles, avg cost halves. **Existing trailing stops are NOT guaranteed to be auto-adjusted** — Alpaca explicitly reserves the right to cancel or adjust at its discretion. Reverse splits historically cancel all GTCs. Forward splits adjust GTC buy-limits and sell-stops, but trailing-stop behavior is documented as discretionary. Defensive design: on corporate action notification, cancel and re-place your trailing stop. Sources: https://docs.alpaca.markets/docs/mandatory-corporate-actions and https://forum.alpaca.markets/t/please-fix-how-you-handle-stock-splits/4484

### 8. Quote response shape on illiquid/halted stocks
The `latest quote` endpoint always returns a quote object, but fields can be **zero or stale**: `bp=0`, `ap=0`, `bs=0`, `as=0` are all observed in the wild for halted or pre-IPO symbols. The `t` (timestamp) and `c` (conditions array) help — conditions like `"R"` (regular), `"H"` (halt-related), or empty arrays signal staleness. **Never assume `quote.ap > 0`**; validate before computing spread or placing orders against it. Sources: https://forum.alpaca.markets/t/the-api-get-last-quote-is-returning-zero-ask-bid-prices/4805 and https://docs.alpaca.markets/reference/stocklatestquotesingle-1

### 9. Same-day-stop rejection (PDT/wash)
Still a real issue in 2026. Two distinct rejections to know:
- **Wash trade detection**: HTTP 403, message `"potential wash trade detected. use complex orders"` or reject reason `"opposite side market/stop order exists"`. Triggered when you submit a sell stop on the same symbol you just bought. Workaround: use **bracket orders** or **OCO** — they're explicitly exempted, and **trailing-stop orders are also exempted from wash detection**.
- **PDT protection**: rejects the closing order if it would flag the account as PDT (under $25k). Different message — about day-trade count.
Sources: https://forum.alpaca.markets/t/apierror-potential-wash-trade-detected-use-complex-orders/13441 and https://docs.alpaca.markets/docs/user-protection

### 10. PDT on paper at $100k
Above $25k previous-day equity, **PDT day-trade-count restrictions don't fire** (the >3-day-trades-in-5-days flag is moot because you have buying power). However, **day-trading buying power tracking remains active**: a margin account with $100k gets 4× DTBP (~$400k), and orders that would exceed it are rejected with insufficient-DTBP. Cash/non-margin paper accounts don't get the 4× multiplier. Verify your paper account is provisioned as margin if you're modeling this. Source: https://alpaca.markets/support/pattern-day-trading-protection

### 11. Paper account reset behavior
**Resetting invalidates the API key and secret** — old credentials return 401. Open orders, positions, and history are wiped. The newer dashboard model is "create/delete paper account" rather than reset, but the credential implication is identical: a fresh account = fresh keys. Bake key-rotation handling into the bot, or it'll silently fail post-reset. Sources: https://forum.alpaca.markets/t/paper-trading-api-key-changes-with-reset/939 and https://docs.alpaca.markets/docs/paper-trading

### 12. Account status edge cases
Status values: `INACTIVE`, `ONBOARDING`, `SUBMITTED`, `SUBMISSION_FAILED`, `ACTION_REQUIRED`, `APPROVAL_PENDING`, `APPROVED`, `REJECTED`, `ACTIVE`, `ACCOUNT_UPDATED`, `ACCOUNT_CLOSED`. **Only `ACTIVE` permits trading.** `ACCOUNT_UPDATED` (transient during personal-info updates) blocks trades briefly. Also check the boolean flags `trading_blocked`, `account_blocked`, `transfers_blocked`, `pattern_day_trader`, and `trade_suspended_by_user` on `GET /v2/account` — any can independently block orders even when status is `ACTIVE`. Source: https://docs.alpaca.markets/docs/accounts-statuses
