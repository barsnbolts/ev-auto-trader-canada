# Research playbook — deeper, faster

This codifies how Claude does research on this project. The default mode is **parallel dispatch**, not serial. Serial WebSearch with one query at a time is the slowest possible loop and burns the context window for very little signal. Parallel sub-agent fan-out + multi-source MCPs in the same tool batch is the standard.

The TL;DR rule: **if a research task touches ≥3 facts or ≥2 sources, I never do it in serial. I emit one tool batch with N parallel calls.** When the topic is large enough to be its own deliverable (a whole vehicle's worth of specs, a multi-vendor library survey), I spawn parallel sub-agents instead.

## Source matrix — which tool for which question

| Question shape | First-line tools (parallel) | Second-line | Notes |
|---|---|---|---|
| Single fact, well-indexed (e.g. "EPA range of MY2024 X") | `WebSearch` + `mcp__9a04470a__web_search_exa` in same batch | `WebFetch` on the top hit | Two engines beats one — Exa surfaces semantic matches Google misses. |
| Multiple facts on one product (full spec sheet) | `Agent` × N parallel sub-agents, each owning one fact | `mcp__Apify__apify--rag-web-browser` for spec PDFs | One agent per spec section. Run all in one message. |
| Drift-monitoring (pricing change, rebate status) | `mcp__9a04470a__web_search_exa` with date hints | scheduled task via `mcp__scheduled-tasks__create_scheduled_task` | Exa's recency ranking beats Google for "what changed last month". |
| Live structured data (used listings, charger availability) | `mcp__Apify__search-actors` → pick → `mcp__Apify__call-actor` | Chrome MCP fallback | Apify already hosts AutoTrader, Kijiji, PlugShare scrapers — don't roll your own. |
| Deep semantic questions ("how do other apps display range derate?") | `Agent` parallel × 3 with different angles | `WebFetch` on each agent's top URL | Sub-agents reason about results before reporting back; their summary is shorter than raw HTML. |
| Codebase questions ("does this lib exist on npm?") | `Agent` (Explore) + `WebSearch` for npm | `WebFetch` on package README | Local search first, then network. |
| Whole-domain sweep ("what's the state of EV trip-planning libs in 2026") | `Agent` × 5 parallel — split by sub-domain | merge findings into single research doc | Spawn many; have each report ≤200 words. |

## The four forbidden anti-patterns

1. **Serial WebSearch loop.** Calling WebSearch, reading the result, calling WebSearch again. Always batch.
2. **WebSearch → WebFetch → WebSearch round-trip.** Round-trips drain context. Fetch the candidate URLs in the same batch as the search if you can predict them.
3. **One agent doing five things.** A single sub-agent processing five sub-topics serially is no faster than me doing it. Spawn five agents.
4. **Reading raw HTML in main context.** WebFetch returns markdown but it's still big. If the answer is "yes/no/3.2 kW" send it to a sub-agent and have the agent return the answer.

## The parallel-dispatch pattern (canonical example)

When researching "Nissan Ariya 2024 specs for seed.json", the correct dispatch is one tool message containing all of these in parallel:

```
Agent("battery + range from EVDB", prompt="...EVDB URL + pull battery_kwh, usable, range_km, range_protocol, AC max, DC max")
Agent("Canadian pricing", prompt="...Nissan Canada press release + AutoTrader.ca + return MSRP per trim")
Agent("EPA + InsideEVs", prompt="...InsideEVs spec overview + EPA fueleconomy.gov + return mi range per trim")
Agent("thermal data", prompt="...Bjorn Nyland tests + Recurrent Auto cold-weather data for Ariya/Leaf platform + return DC cold-soak curve")
Agent("rebate eligibility", prompt="...iZEV current status + Ontario rebate status as of today")
```

Five agents run in parallel. Total wall-clock = slowest agent. Each returns a structured short summary. I assemble the final seed.json entry.

The wrong pattern (serial) takes 5× longer and uses ~3× the tokens.

## Tool inventory — what's available right now

| Tool | What it does | When to use |
|---|---|---|
| `WebSearch` | Anthropic-native search | First-line for English-language web facts |
| `WebFetch` | URL → markdown + LLM extract | When you have a known URL and want a specific extract |
| `mcp__9a04470a__web_search_exa` | Exa semantic search | Recency ranking, semantic matches Google misses |
| `mcp__9a04470a__web_fetch_exa` | Exa URL fetch with content extract | Cleaner extraction than raw fetch on JS-heavy pages |
| `mcp__Apify__search-actors` | Find a pre-built scraper for a site | Before rolling your own scrape, check Apify |
| `mcp__Apify__call-actor` | Run a hosted scraper | AutoTrader, Kijiji, PlugShare — already built |
| `mcp__Apify__apify--rag-web-browser` | RAG-style multi-page browsing | Multi-page docs, OEM spec PDFs |
| `mcp__Claude_in_Chrome__*` | Real browser scraping | Last resort for JS-protected pages |
| `Agent` (general-purpose, Explore) | Sub-agent fan-out | Anything ≥3 facts or ≥2 sources |
| `mcp__scheduled-tasks__create_scheduled_task` | Cron a research run | Drift monitoring (rebate status, pricing) |

## Where the keys live

- **Exa**: client-side via the `9a04470a` MCP — no env key needed by my Python scripts.
- **Apify**: same — MCP-mediated, no key in repo.
- **WebSearch / WebFetch**: built-in.
- **Chrome MCP**: requires the user's Chrome extension running locally.

If a Python script ever needs direct API access (vs MCP), keys go in `.env.local` (gitignored) and are documented in `docs/external_keys.md`.

## Output discipline

Every research run writes to `docs/research/auto/<topic>-<date>.md` with:

```
# <topic> — <date>

**Goal.** One sentence on why this was researched.

**Findings.** Bulleted, each line ending with `[source: <url>]`.

**Confidence per finding.** High/Medium/Low. If Medium or Low, name the gap.

**ROI / next steps.** What this unlocks. What's still uncertain.
```

Even dead-ends get logged so future sessions don't re-run the same search.

## When to NOT spawn agents

- One-fact lookups where I already know the canonical URL — just `WebFetch`.
- Codebase navigation — local tools (Read/Grep/Glob) are faster than any agent.
- Anything I can answer from memory — no need to confirm well-known facts.

## Iteration cadence

After each research session, append a one-liner to `LEARNINGS.md` capturing what worked and what didn't (which sources were strongest, which dispatch shapes were too slow). The playbook updates from those notes — see `scripts/self_audit.py` for the prune cycle.
