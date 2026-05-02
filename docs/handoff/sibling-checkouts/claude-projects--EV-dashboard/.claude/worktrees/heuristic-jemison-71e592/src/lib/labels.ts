export interface BiLabel {
  geek: string;
  plain: string;
}

function bi(geek: string, plain: string): BiLabel {
  return { geek, plain };
}

// Resolve a BiLabel or plain string given the current mode.
export function resolve(label: string | BiLabel, plainMode: boolean): string {
  if (typeof label === "string") return label;
  return plainMode ? label.plain : label.geek;
}

// Term dictionary — used in VehicleRow and anywhere else a geek/plain swap is needed.
export const TERM = {
  range:         bi("Range",           "Estimated distance"),
  peakDc:        bi("Peak DC",         "Fast charging speed"),
  port:          bi("Port",            "Charging plug type"),
  powertrain:    bi("Powertrain",      "Engine type"),
  msrp:          bi("MSRP",            "Starting price"),
  confidence:    bi("Confidence",      "How sure we are"),
  ratedRange:    bi("Rated range",     "Rated driving range"),
  batteryUsable: bi("Battery (usable)","Battery size (usable)"),
  batteryTotal:  bi("Battery (total)", "Battery size (total)"),
  chemistry:     bi("Chemistry",       "Battery type"),
  heatPump:      bi("Heat pump",       "Efficient cabin heater"),
  thermalMgmt:   bi("Thermal mgmt",   "Battery temperature system"),
  peakDcRated:   bi("Peak DC rated",  "Max fast-charge speed"),
  maxAc:         bi("Max AC",         "Home charging speed"),
  cargo:         bi("Cargo",          "Cargo space"),
  towRating:     bi("Tow rating",     "Towing capacity"),
  curbWeight:    bi("Curb weight",    "Vehicle weight"),
  federal:       bi("Federal iZEV",   "Federal rebate"),
  provincial:    bi("Ontario rebate", "Ontario rebate"),
  degradation:   bi("Projected degradation", "Battery aging over time"),
  rangeAt5yr:    bi("Range at 5 yr",  "Range in ~5 years"),
  rangeAt8yr:    bi("Range at 8 yr",  "Range in ~8 years"),
  rangeAt10yr:   bi("Range at 10 yr", "Range in ~10 years"),
  rangeSlider:   bi("Range @ slider", "Range at these conditions"),
  usable:        bi("Effective usable","Usable battery"),
  peakDcSlider:  bi("Peak DC @ slider","Fast-charge speed now"),
  consumption:   bi("Effective consumption","Energy used per km"),
  costPer100:    bi("Cost / 100 km (est.)","Estimated cost per 100 km"),
  retained:      bi("Capacity retained","Battery health"),
  hvacDraw:      bi("HVAC draw",      "Heater/AC power"),
  generation:    bi("Generation",     "Model year / generation"),
  trim:          bi("Trim",           "Trim level"),
  powertrainRow: bi("Powertrain",     "Engine type"),
  bodyStyle:     bi("Body style",     "Vehicle shape"),
  drivetrain:    bi("Drivetrain",     "Drive type"),
  seats:         bi("Seats",          "Seating capacity"),
  cargoSeatsUp:  bi("Cargo (seats up)", "Cargo space (seats up)"),
  cargoSeatsDown:bi("Cargo (seats down)", "Cargo space (seats down)"),
} as const;

export type TermKey = keyof typeof TERM;

// Powertrain shorthand → plain label
export const POWERTRAIN_PLAIN: Record<string, string> = {
  BEV: "Electric only",
  PHEV: "Plug-in hybrid",
  EREV: "Extended-range EV",
  FCEV: "Hydrogen fuel cell",
};

// Protocol shorthand → plain label
export const PROTOCOL_PLAIN: Record<string, string> = {
  EPA: "Government test",
  WLTP: "European test",
  NEDC: "Old European test",
};
