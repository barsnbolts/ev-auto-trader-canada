// Used-market deep-link templates for AutoTrader.ca, Kijiji, Leasebusters.
// Verified working 2026-05-02 (see docs/handoff/research/A0_findings_2026-05-02.md §4).
// Personal-use, no scraping — these are search-result URL templates the buyer
// clicks through to the live marketplace.
//
// Leasebusters is form-only (POST search, no querystring) so we can't deep-
// link to a pre-filtered search. Surface the base URL with a tooltip
// explaining the buyer needs to manually filter by make/model.

import type { Model } from "./constants";
import type { Province } from "./constants";

// AutoTrader uses lowercase make + model (spaces -> "+"). Province is a
// lowercase 2-letter code. rcp = results count per page; rcs = start offset.
function autoTraderModelSlug(model: Model): string {
  switch (model) {
    case "Ioniq5":
      return "ioniq+5";
    case "Ioniq6":
      return "ioniq+6";
    case "Ioniq9":
      return "ioniq+9";
    case "EV6":
      return "ev6";
    case "EV9":
      return "ev9";
  }
}

function autoTraderMake(model: Model): "hyundai" | "kia" {
  return model.startsWith("Ioniq") ? "hyundai" : "kia";
}

// Kijiji uses kebab-case keywords + a category/location/make-attribute path.
// l9004 = Ontario; l0 = Canada-wide. a54 = Hyundai, a52 = Kia (numeric attr).
const KIJIJI_PROVINCE_CODE: Record<Province, string> = {
  ON: "l9004",
  BC: "l9007",
  AB: "l9003",
  SK: "l9006",
  MB: "l9005",
  QC: "l9001",
  NB: "l9008",
  NS: "l9009",
  NL: "l9011",
  PE: "l9010",
  NT: "l9013",
  NU: "l9014",
  YT: "l9012",
};

const KIJIJI_MAKE_CODE: Record<"hyundai" | "kia", string> = {
  hyundai: "a54",
  kia: "a64", // verified separate from Hyundai's a54
};

function kijijiModelKeyword(model: Model): string {
  switch (model) {
    case "Ioniq5":
      return "ioniq-5";
    case "Ioniq6":
      return "ioniq-6";
    case "Ioniq9":
      return "ioniq-9";
    case "EV6":
      return "ev6";
    case "EV9":
      return "ev9";
  }
}

const KIJIJI_PROV_SLUG: Record<Province, string> = {
  ON: "ontario",
  BC: "british-columbia",
  AB: "alberta",
  SK: "saskatchewan",
  MB: "manitoba",
  QC: "quebec",
  NB: "new-brunswick",
  NS: "nova-scotia",
  NL: "newfoundland-labrador",
  PE: "prince-edward-island",
  NT: "northwest-territories",
  NU: "nunavut",
  YT: "yukon",
};

export type UsedListingLinks = {
  autoTrader: string;
  kijiji: string;
  leasebusters: string;
  /** Set when no deep-link is possible (e.g. Leasebusters); render with tooltip. */
  leasebustersIsManualSearch: true;
};

// Build all 3 deep-links for a given model + province. The buyer clicks
// through to a live search-results page on each marketplace.
export function usedListingsFor(model: Model, province: Province): UsedListingLinks {
  const make = autoTraderMake(model);
  const at = `https://www.autotrader.ca/cars/${make}/${autoTraderModelSlug(model)}/${province.toLowerCase()}/?rcp=20&rcs=0&sts=Used`;
  const kj = `https://www.kijiji.ca/b-cars-trucks/${KIJIJI_PROV_SLUG[province]}/${kijijiModelKeyword(model)}/${make}/k0c174${KIJIJI_PROVINCE_CODE[province]}${KIJIJI_MAKE_CODE[make]}`;
  // Leasebusters has no deep-link; surface the EV vehicle search page.
  // Buyer manually filters by make/model after landing.
  const lb = `https://www.leasebusters.com/vehicle-search/Leasing`;
  return {
    autoTrader: at,
    kijiji: kj,
    leasebusters: lb,
    leasebustersIsManualSearch: true,
  };
}
