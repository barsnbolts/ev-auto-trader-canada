// Plain-English label mapping for "mom mode" (jargon toggle).
// When mom_mode is on, labels get swapped to approachable English. Keys are
// the internal jargon labels; values are the friendly versions. If a key is
// missing, the original label is used.
//
// --- PORTED VERBATIM from EV-dashboard sibling ---
export const PLAIN: Record<string, string> = {
  // Adjusted-for-conditions section
  "Range @ slider": "How far it'll actually go",
  "Effective usable": "Energy available (after cold/heat)",
  "Peak DC @ slider": "Fastest charging speed",
  "Effective consumption": "Energy used per km",
  "Capacity retained": "Battery working at",
  "HVAC draw": "Heater / AC power",
  "Cost per 100 km": "Cost to drive 100 km",

  // Identity
  "Generation": "Model year family",
  "Trim": "Trim level",
  "Powertrain": "Engine type",
  "Body style": "Body shape",
  "Drivetrain": "Drive wheels",

  // Rated
  "Rated range": "Official range",
  "Battery (usable)": "Battery (you can use)",
  "Battery (total)": "Battery (full pack)",
  "Chemistry": "Battery type",
  "Heat pump": "Has heat pump?",
  "Thermal mgmt": "Cooling system",
  "Peak DC rated": "Top charging speed",
  "Max AC": "Home charging speed",
  "Port": "Charging plug",

  // Utility
  "Seats": "Seats",
  "Cargo (seats up)": "Cargo space (normal)",
  "Cargo (seats down)": "Cargo space (folded)",
  "Tow rating": "Can tow",
  "Curb weight": "Weight",

  // Cost
  "MSRP": "Price",
  "Federal iZEV": "Federal rebate",
  "Ontario rebate": "Ontario rebate",

  // New sections
  "Range at 5 yr": "Range after 5 years",
  "Range at 8 yr": "Range after 8 years",
  "Range at 10 yr": "Range after 10 years",
  "iZEV eligible": "Gets federal rebate?",
};

// --- PROJECT-SPECIFIC TOOLTIP GLOSSARY ---
// Used via plainLang(termKey) to populate title= attributes for hover tooltips.
// Pattern: <span title={plainLang("OTD")} className="cursor-help underline decoration-dotted underline-offset-2">OTD</span>

const GLOSSARY: Record<string, string> = {
  "OTD": "Out-the-door price — the actual cheque you write, including taxes, fees, and freight.",
  "freight": "Freight & PDI — what the dealer charges to ship and prep the vehicle. Mandatory across all dealers.",
  "freightPdi": "Freight & PDI — shipping + pre-delivery inspection charge. Always included in the OTD price.",
  "moneyFactor": "Lease interest as a tiny decimal (APR ÷ 2400). 0.0017 ≈ 4.08% APR.",
  "residualPercent": "What the lease company thinks the car will be worth at lease-end, as a % of MSRP. Higher residual = lower lease payment.",
  "capCost": "Capitalized cost — the lease's version of the sale price. MSRP + freight is typical.",
  "capReduction": "Money you put down up front on a lease. Reduces what you finance.",
  "buyerContext": "Your situation — province (taxes), and whether you currently own a Hyundai/Kia (loyalty) or a competing brand (conquest).",
  "loyalty": "Loyalty cash — Hyundai/Kia gives a discount if you currently own one of theirs.",
  "conquest": "Conquest cash — Hyundai/Kia gives a discount if you currently own a competing brand (Toyota, Honda, Tesla, etc.).",
  "EVAP": "Electric Vehicle Availability Program — Canadian federal rebate scheme, currently inactive.",
  "iZEV": "Federal Zero-Emission Vehicle rebate. Currently $0 (program paused).",
  "daysOnLot": "Days since we first saw this listing in our daily AutoTrader sweep. Longer = more negotiation room. (Tracking started 2026-05-02 with the new stable-ID scheme — values will keep climbing accurately from here as the daily cron accumulates history.)",
  "msrp": "Manufacturer's Suggested Retail Price — what Hyundai/Kia publish. Dealer asking is usually different.",
  "asking": "What the dealer's listing shows. The starting point of negotiation.",
  "finance": "You borrow money, take the car home, and own it after the loan ends.",
  "lease": "You rent the car for a fixed term. Lower monthly than financing, but you don't own it at the end (unless you buy it out).",
  "cash": "You pay the full OTD price now and own it outright.",
};

/** Return a plain-English tooltip string for a jargon term key. */
export function plainLang(key: string): string {
  return GLOSSARY[key] ?? key;
}
