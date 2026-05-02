// Plain-English label mapping for "mom mode" (jargon toggle).
// When mom_mode is on, labels get swapped to approachable English. Keys are
// the internal jargon labels; values are the friendly versions. If a key is
// missing, the original label is used.

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

export function labelFor(key: string, momMode: boolean): string {
  if (!momMode) return key;
  return PLAIN[key] ?? key;
}
