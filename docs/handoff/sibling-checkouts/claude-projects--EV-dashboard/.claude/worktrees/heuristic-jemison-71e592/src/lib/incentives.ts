// F-11 — federal iZEV + Ontario provincial rebate state.
//
// As of 2026, iZEV is paused (closed Mar 31 2025; replacement EVAP launched
// Feb 2026 but caps + eligibility are still being clarified). Ontario has had
// no provincial EV rebate since 2018.
//
// Until the iZEV check cron (`scripts/research_client.py` + the
// `ev-izev-drift-monitor` scheduled task) detects a status change, every
// vehicle's federal_izev_cad in seed.json should display $0 with a one-line
// disclaimer. The flag here is the single source of truth for the UI.
//
// To unpause: flip `incentivePaused` to false, set `currentFederalCapCad` +
// `currentFederalRebateCad` to the resumed program's values, run validate.py,
// commit. Optionally regenerate seed.json's federal_izev_cad fields by hand.

export const incentivePaused = true as const;

/** Latest known status / source. Update when flipping the flag. */
export const incentiveStatusSource = {
  url: "https://tc.canada.ca/en/road-transportation/innovative-technologies/zero-emission-vehicles/incentives-zero-emission-vehicles-izev",
  name: "Transport Canada — iZEV program page",
  asOf: "2026-04-24",
};

/** Disclaimer string shown in CompareView when incentivePaused is true. */
export const incentivePausedDisclaimer =
  "Federal iZEV is paused — verify current status at canada.ca before relying on this number.";

/** Ontario provincial rebate state (no rebate since July 2018). */
export const ontarioProvincialRebateCad = 0;
export const ontarioProvincialRebateNote =
  "Ontario has had no provincial EV rebate since the EVIP was cancelled in July 2018.";

/** When iZEV resumes, set these. */
export const currentFederalCapCad = 0;
export const currentFederalRebateCad = 0;
