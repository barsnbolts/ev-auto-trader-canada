# EV Dashboard — User Guide

*For Ian and mom. No jargon required.*

---

## Starting the app

Double-click **Start-Desktop-App.command** in the project folder. A window opens showing all 20 EVs and plug-in hybrids sold in Canada.

If it's your first time and nothing happens, right-click the file and choose "Open".

---

## The main list

Every vehicle in the list is a long-range trim — the version with the biggest battery. The list shows:

- **Range** — how far it can drive on a charge (EPA government test figure)
- **Peak DC** — how fast it charges at a public fast-charger
- **Charging plug** — whether it uses CCS1 (most vehicles) or Tesla's NACS connector
- **Starting price** — base MSRP in Canadian dollars before any rebates

### Filtering

Use the buttons at the top to narrow the list:

| Filter | What it does |
|--------|-------------|
| BEV / PHEV / EREV | Battery-only, plug-in hybrid, or extended-range hybrid |
| Body style | Sedan, Crossover, SUV, Truck, etc. |
| Drive type | Single motor (front or rear) vs. all-wheel drive |
| Max $ / Min km | Price ceiling and range floor |

Click **Reset** to clear all filters.

---

## Comparing vehicles

1. Click the **+** button on any vehicle row to add it to the comparison tray (bottom of the screen). You can add up to 4 vehicles.
2. Click **Compare →** in the tray to open the comparison view.
3. Click **← Back** to return to the list.

### The Plain / Geek toggle

In the top-right corner of the header is a **Plain · Geek** button.

- **Plain mode** — labels use everyday words: "Estimated distance", "Fast charging speed", "Battery size"
- **Geek mode** — labels use industry shorthand: "Range", "Peak DC", "Battery (usable)"

The setting saves automatically — it will still be on the same mode next time you open the app.

---

## The comparison view

### Conditions panel (always visible)

At the top of the comparison view, a set of controls lets you adjust real-world conditions. Every row in the specs table updates live as you change these.

| Control | What it changes |
|---------|----------------|
| **Ambient temp slider** (−40 °C to +40 °C) | Simulates cold winters or hot summers |
| **HVAC on** checkbox | Turns on heating or air conditioning |
| **Speed** | Affects energy consumption (faster = less range) |
| **Battery preconditioned** | Whether the battery was warmed up before arriving at a fast-charger |

### Specs tab

The specs table has three sections:

**Identity** — generation, trim level, engine type, body style, drive type.

**How it performs right now** (adjusts with the conditions slider):
- Range at the current temperature and speed
- Usable battery size at current temperature
- Fast-charging speed (drops in cold weather)
- Energy used per kilometre
- Estimated cost per 100 km (calculated from your electricity rate in the Ontario Hydro time-of-use tiers)

**Fixed specs** — rated range, full battery specs, port type, home charging speed, cargo space, towing, weight, rebates.

The coloured badge beside each number shows **confidence**:
- **H (High)** — confirmed from two or more independent sources
- **M (Medium)** — one source or an estimate
- **L (Low)** — uncertain; use as a rough guide only

### Map & Range tab

A map of Ontario centred on Toronto, showing:

- **Coloured range rings** — one per vehicle. The solid ring is full range; the dashed inner ring is 50% range. The rings update when you move the temperature slider.
- **DCFC charging station pins** — 15 major fast-charging locations across Ontario (Electrify Canada, Tesla Supercharger, Petro-Canada). Click any pin to see the network name and charging speed.

> **Tip:** Move the temperature slider to −20 °C and watch the rings shrink. This answers "can I make it to Ottawa in February?"

### Trip Plan tab

Plan a drive from one city to another. Enter a start and end address, then click **Plan trip**. The app calculates where each vehicle would need to stop to charge, how long each stop takes, and the estimated cost.

### Used Market tab

Shows recent used listings for each vehicle from AutoTrader and Kijiji Ontario, including a price range and links to current listings. Results are cached for 24 hours.

> Requires an Exa API key in `.env.local`. See `docs/external_keys.md` for setup.

---

## DC charging curves

Below the specs table, the **DC Charging Curves** chart shows how fast each vehicle charges at different battery levels (0–100%). A long, flat top means the vehicle holds peak speed longer. A steep drop means charging slows quickly above 50%.

---

## Ontario electricity rates

The cost estimates use Ontario Hydro time-of-use rates. A small dropdown lets you switch between:

| Tier | Rate | Typical times |
|------|------|---------------|
| Off-peak | 9.2 ¢/kWh | Nights, weekends |
| Mid-peak | 13.6 ¢/kWh | Shoulder hours |
| On-peak | 17.9 ¢/kWh | Weekday mornings and evenings |

---

## Data sources and credits

All numbers are hand-researched and cited. Every value links back to:

- **Geotab** — winter range and charging data from real-world fleet telematics
- **Recurrent Auto** — battery health and degradation reports from 15,000+ EVs
- **Fastned** — DC charging curve measurements
- **P3 Group** — independent EV charging benchmarks
- **Bjørn Nyland** — range and charging test videos (YouTube)
- **InsideEVs, MotorTrend, manufacturer press kits** — specifications and pricing

Confidence badges (H/M/L) reflect how many independent sources agreed on a given number.

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close the comparison view |
| `←` / `→` | Navigate left/right in the compare table (when focused) |

---

## Troubleshooting

**The map is blank.** Wait 2–3 seconds for the tiles to load. Requires an internet connection.

**Range numbers seem too high.** The default conditions are +20 °C with HVAC off at 100 km/h — ideal summer conditions. Move the slider to −20 °C and turn on HVAC for a realistic Ontario winter estimate.

**The app won't open.** Right-click the `.command` file and choose "Open". macOS may block unsigned apps on first launch.

**Prices look out of date.** MSRP data is updated manually. Check the confidence badge — if it's M or L, the price may have changed. The `scripts/validate.py` script flags data older than 90 days.
