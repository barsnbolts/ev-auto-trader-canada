# External API keys — how to generate them

Everything in this project ships with a feature-flag stub so missing keys never block the app. When you're ready to unlock map, charging-station pins, and trip planning, generate these keys and drop them into `.env.local`.

> `.env.local` is gitignored — never commit keys. The app reads them at dev-server / build time via Vite's `import.meta.env.VITE_*` pattern.

## 1. Apple MapKit JS token — for the map panel

**What it unlocks:** `MapPanel.tsx` renders an Apple Map centered on your location. Without this, the map area shows a placeholder card with a link back to this doc.

**Cost:** free for personal use. Apple's free tier covers ~250k map service loads per day (way more than we need).

**Steps:**

1. Visit <https://maps.developer.apple.com/token-maker>.
2. Sign in with your Apple ID (the free one is fine — you don't need a paid Apple Developer Program membership for MapKit JS tokens for personal use, though a free Developer account is required to generate the underlying key).
3. If it's your first time, the site walks you through creating a Maps Identifier + key:
   - Create a **Maps ID** (reverse-DNS style, e.g. `maps.ian.ev-dashboard`).
   - Create a **Key** with MapKit JS capability; associate it with the Maps ID.
   - Download the `.p8` file (keep it safe — this is the private key).
4. Back in the token-maker, paste your key ID + team ID + `.p8` contents. The tool generates a JWT valid for up to 1 year.
5. Copy the JWT string.

**Add to your project:**

```bash
# Create or edit .env.local in the project root
VITE_APPLE_MAPKIT_TOKEN=eyJhbGciOiJFUzI1NiIsI...
```

Restart `npm run dev` and the map panel lights up.

**Token renewal:** 1-year max validity. `scripts/self_audit.py` flags when your token is within 30 days of expiry.

**Docs:**
- <https://developer.apple.com/documentation/mapkitjs>
- <https://developer.apple.com/help/account/capabilities/create-a-maps-identifier-and-private-key/>

---

## 2. Open Charge Map API key — for DCFC station pins

**What it unlocks:** `MapPanel.tsx` overlays fast-charger pins (Electrify Canada, Petro-Canada, ChargePoint, FLO, Tesla Superchargers, etc.) inside your range rings.

**Cost:** free. OCM has a courteous-use policy rather than a strict rate limit. We cache responses per bounding box for 1 hour to stay well within it.

**Steps:**

1. Visit <https://openchargemap.org/site/develop/api>.
2. Click "Register" (or sign in) to create an account.
3. After logging in, find "My Apps" / "Register a new app." Give your app any name (e.g. "EV Dashboard — personal").
4. Copy the API key it generates.

**Add to your project:**

```bash
# In .env.local
VITE_OCM_API_KEY=abcdef1234567890
```

Restart `npm run dev` and charger pins appear on the map.

**Docs:**
- <https://openchargemap.org/site/develop/api>

---

## 3. ABRP (A Better Route Planner) API key — for trip planning

**What it unlocks:** `TripPlanner.tsx` plans multi-stop EV trips — destination input, route line, per-vehicle charge-stop list with time estimates. Uses ABRP's industry-standard routing engine with vehicle-aware consumption curves.

**Cost:** ABRP's consumer tier is free for individual use. Premium ($5/month or $50/year) adds CarPlay / live traffic / weather features we don't need in-app.

**Steps:**

1. Visit <https://abetterrouteplanner.com/>.
2. Sign up (or log in) — a free account is enough.
3. Go to <https://abetterrouteplanner.com/resources/api> and follow the "Get API access" instructions. For personal/non-commercial use, ABRP typically responds within a few business days with a key.
4. If pricing is surprising when you apply, the app's self-built fallback engine (Mapbox + Open Charge Map + our thermal model) kicks in automatically via `VITE_ROUTE_ENGINE=selfbuilt`. You won't lose the trip-planner feature — just the ABRP-sourced consumption precision.

**Add to your project:**

```bash
# In .env.local
VITE_ABRP_API_KEY=your-abrp-key
VITE_ROUTE_ENGINE=abrp            # or "selfbuilt" if you prefer the fallback
```

**Docs:**
- <https://abetterrouteplanner.com/resources/api>

---

## 4. Exa + Apify — for autonomous Python-side research

**What it unlocks:** `scripts/research_client.py` can call Exa (semantic search + content extraction) and Apify (hosted scrapers for AutoTrader / Kijiji / PlugShare / etc.) directly from Python, instead of routing every research query through Claude's MCP path. Result: batch research jobs (Exa-verify all 24 vehicles' pricing in one run, refresh every used-listing source nightly via cron) become genuinely autonomous and cheap.

**Cost:** both have free tiers that comfortably cover personal use.

**Steps:**

1. **Exa** — visit <https://exa.ai>, sign up, copy your API key from the dashboard. Free tier: 1000 queries/month.
2. **Apify** — visit <https://console.apify.com/account/integrations>, copy your "Personal API token". Free tier: $5/mo of compute, plenty for nightly EV-listing scrapes.

**Add to `.env.local`:**

```bash
EXA_API_KEY=...
APIFY_API_TOKEN=...
```

**Verify:** `python3 scripts/research_client.py --status` shows ✅ for both. Then:

```bash
python3 scripts/research_client.py --search "Hyundai Kona Electric 2025 EPA range" -n 3
python3 scripts/research_client.py --fetch "https://www.fueleconomy.gov/feg/bymodel/2025_Hyundai_Kona.shtml"
```

**Without these keys, the project still works** — `scripts/research.py` and `scripts/research_vehicle.py` fall through to the Claude-MCP dispatch path. The keys are an *acceleration*, not a requirement.

---

## 5. `.env.local` full template

```bash
# Copy this to .env.local (do NOT commit it — .env.local is in .gitignore)

# Ontario home coordinate for map center. Defaults to Toronto City Hall if unset.
VITE_HOME_LATITUDE=43.6532
VITE_HOME_LONGITUDE=-79.3832
VITE_HOME_POSTAL_CODE=M5H2N2

# Electricity rate override (default = 17¢/kWh Ontario TOU mid-peak)
# VITE_ELECTRICITY_RATE_CAD=0.17

# Apple MapKit JS (from maps.developer.apple.com/token-maker)
VITE_APPLE_MAPKIT_TOKEN=

# Open Charge Map (from openchargemap.org/site/develop/api)
VITE_OCM_API_KEY=

# A Better Route Planner (from abetterrouteplanner.com/resources/api)
VITE_ABRP_API_KEY=
VITE_ROUTE_ENGINE=abrp

# Exa (semantic web search + content extraction; from https://exa.ai dashboard)
EXA_API_KEY=

# Apify (hosted scrapers; from https://console.apify.com/account/integrations)
APIFY_API_TOKEN=
```

---

## Safety reminders

- **`.env.local` is gitignored.** If you ever accidentally stage it, the pre-commit hook blocks the commit.
- **Never share your MapKit private key (`.p8`).** Only the JWT token goes in `.env.local`. The `.p8` stays on your Mac.
- **If you rotate a key, update `.env.local` and restart the dev server.** There's no long-lived cache on the app side for secrets.
- **This app is personal use only.** If you ever decide to share it with someone outside your household, remove the keys from the app and have the other person generate their own. Each key is tied to an Apple/OCM/ABRP account.
