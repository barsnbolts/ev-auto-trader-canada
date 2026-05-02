import { ON_DEALER_FEES, PROVINCE_TAX, bcPstRateFor, type Province } from "./constants";
import transportBandsData from "../../data/transport-bands.json";
import type {
  Dealer,
  Incentive,
  IncentiveLine,
  IncentiveScope,
  InventoryUnit,
  ScoredUnit,
} from "./types";

type TransportBands = {
  sameProvince: number;
  neighbour: number;
  regional: number;
  crossCountry: number;
  neighbours: Record<string, string[]>;
  regionalGroups: Record<string, string[]>;
};
const TRANSPORT_BANDS = transportBandsData as unknown as TransportBands;

// Flat-rate transport heuristic. NOT a quote — just enough to make
// cross-province deals comparable on the dashboard. Adds a separate line
// to the OTD breakdown so the buyer can see why an Alberta deal isn't
// actually $2k cheaper.
export function transportCost(dealerProv: Province, buyerProv: Province): number {
  if (dealerProv === buyerProv) return TRANSPORT_BANDS.sameProvince;
  if (TRANSPORT_BANDS.neighbours[buyerProv]?.includes(dealerProv)) {
    return TRANSPORT_BANDS.neighbour;
  }
  for (const group of Object.values(TRANSPORT_BANDS.regionalGroups)) {
    if (group.includes(dealerProv) && group.includes(buyerProv)) {
      return TRANSPORT_BANDS.regional;
    }
  }
  return TRANSPORT_BANDS.crossCountry;
}

export type { IncentiveLine } from "./types";

// E-GMP cars are assembled in Korea (and US for some Ioniq 5 trims) so they
// are NOT Canadian-made. EVAP cap applies in full to every unit we track.
const E_GMP_IS_IMPORTED = true;

// Cash incentive scopes that come off the OTD as a contract-level deduction.
// lease_promo / finance_promo are APR-based (modeled as monthly payment, not
// price), and charger_install is a separate budget line.
const OTD_ELIGIBLE_SCOPES: ReadonlySet<IncentiveScope> = new Set([
  "federal",
  "provincial",
  "manufacturer_cash",
  "loyalty",
  "conquest",
]);

// Programs that are scoped "provincial" or similar but that pay out as a
// loan-rate or post-purchase reimbursement, not as a contract-line rebate.
// These should not be subtracted from OTD even though appliesTo matches.
const NON_OTD_INCENTIVE_IDS: ReadonlySet<string> = new Set([
  "nl-takecharge-nlcu-loan-rebate-2026",
]);

// Pre-tax transaction value used for cap eligibility. Excludes sales tax
// (matches Transport Canada's EVAP rule).
export function preTaxTransactionValue(unit: InventoryUnit): number {
  return (
    unit.dealerAskingPrice +
    unit.freightPdi +
    ON_DEALER_FEES.airConditioningExciseTax
  );
}

// Pre-tax value AFTER manufacturer cash has been applied. EVAP's $50k cap is
// measured against the contract value at signing — a $58k Ioniq 6 with a
// $16k OEM bonus is a $42k contract and therefore EVAP-eligible.
export function effectivePreTaxValue(
  unit: InventoryUnit,
  applicable: Incentive[] = [],
): number {
  const oemCash = applicable
    .filter(
      (i) =>
        i.scope === "manufacturer_cash" &&
        i.status === "active" &&
        i.amountCad !== undefined,
    )
    .reduce((s, i) => s + (i.amountCad ?? 0), 0);
  return Math.max(0, preTaxTransactionValue(unit) - oemCash);
}

export function evapEligibleAmount(
  unit: InventoryUnit,
  evap: Incentive | undefined,
  applicable: Incentive[] = [],
): number {
  if (!evap || evap.status !== "active") return 0;
  const cap = evap.transactionValueCapCad;
  if (cap !== undefined && evap.capAppliesToImported && E_GMP_IS_IMPORTED) {
    if (effectivePreTaxValue(unit, applicable) > cap) return 0;
  }
  // Cash/finance/48mo+ lease assumption (default in the dashboard view).
  return evap.leaseTermProration?.["48"] ?? evap.amountCad ?? 0;
}

// Walks the matched-applicable list and returns the per-line dollar amounts
// that come off the OTD, plus the total. EVAP's lease-term proration and
// post-OEM-cash cap check live inside evapEligibleAmount.
export function stackedOtdIncentives(
  unit: InventoryUnit,
  applicable: Incentive[],
): { lines: IncentiveLine[]; totalCad: number } {
  const lines: IncentiveLine[] = [];
  for (const inc of applicable) {
    if (NON_OTD_INCENTIVE_IDS.has(inc.id)) continue;
    if (!OTD_ELIGIBLE_SCOPES.has(inc.scope)) continue;
    if (inc.status !== "active") continue;
    let amount = 0;
    if (inc.id.startsWith("fed-evap")) {
      amount = evapEligibleAmount(unit, inc, applicable);
    } else if (inc.amountCad !== undefined) {
      amount = inc.amountCad;
    }
    if (amount > 0) {
      lines.push({ id: inc.id, name: inc.name, scope: inc.scope, amountCad: amount });
    }
  }
  const totalCad = +lines.reduce((s, l) => s + l.amountCad, 0).toFixed(2);
  return { lines, totalCad };
}

// Sales tax handler. ON: flat HST. BC: 5% GST + progressive PST bracket
// keyed off the pre-tax base. Other provinces: flat PROVINCE_TAX rate.
function salesTaxFor(province: string, preTaxBase: number, vehiclePrice: number): number {
  if (province === "BC") {
    const gst = preTaxBase * 0.05;
    const pst = vehiclePrice * bcPstRateFor(vehiclePrice);
    return +(gst + pst).toFixed(2);
  }
  const rate = PROVINCE_TAX[province as keyof typeof PROVINCE_TAX] ?? 0.13;
  return +(preTaxBase * rate).toFixed(2);
}

// True out-the-door math for a single unit. The buyer-relevant total.
// All cash-equivalent incentives (federal EVAP, provincial rebates,
// manufacturer cash, loyalty/conquest) are subtracted as contract-line
// deductions. APR-based promos and charger-install programs are excluded.
// Sales tax stacks on top of the pre-tax base (vehicle + freight + AC
// excise) per CRA guidance; OMVIC, RDPRM, tire stewardship, and licensing
// are typically post-tax line items.
//
// buyerProvince is what the buyer pays sales tax in (NOT the dealer's
// province) — cross-province purchases pay tax at the buyer's destination
// rate, not the seller's. Defaults to the dealer's province for backward
// compat, but every caller in the app should pass the real buyer province.
// Transport cost line added when buyer != dealer province.
export function computeOtd(
  unit: InventoryUnit,
  dealer: Dealer,
  applicable: Incentive[] = [],
  buyerProvince?: Province,
): ScoredUnit["otdBreakdown"] {
  const taxProv = buyerProvince ?? dealer.province;
  const dealerAdjustment = unit.dealerAskingPrice - unit.msrp;
  const preTaxBase = preTaxTransactionValue(unit);
  const salesTax = salesTaxFor(taxProv, preTaxBase, unit.dealerAskingPrice);
  const transport = transportCost(dealer.province, taxProv);

  const stack = stackedOtdIncentives(unit, applicable);

  const total =
    preTaxBase +
    salesTax +
    transport +
    ON_DEALER_FEES.rdprmFee +
    ON_DEALER_FEES.omvicFee +
    ON_DEALER_FEES.tireStewardshipFee +
    ON_DEALER_FEES.govLicensingEstimate -
    stack.totalCad;

  return {
    msrp: unit.msrp,
    freightPdi: unit.freightPdi,
    dealerAdjustment,
    acExciseTax: ON_DEALER_FEES.airConditioningExciseTax,
    rdprm: ON_DEALER_FEES.rdprmFee,
    omvic: ON_DEALER_FEES.omvicFee,
    tireStewardship: ON_DEALER_FEES.tireStewardshipFee,
    govLicensing: ON_DEALER_FEES.govLicensingEstimate,
    salesTax,
    transportCost: transport,
    salesTaxProvince: taxProv,
    incentivesApplied: stack.lines,
    incentivesTotalCad: stack.totalCad,
    total: +total.toFixed(2),
  };
}

// Filter incentives down to ones that match this unit + dealer. Used both
// for the deal-score stack term and for the per-unit detail panel. EVAP
// transaction-value cap is enforced here so over-cap units don't show the
// rebate as "applicable." Cap is measured against the post-OEM-cash contract
// value, so a $58k Limited AWD with a $16k OEM bonus still gets EVAP.
export function applicableIncentives(
  unit: InventoryUnit,
  dealer: Dealer,
  incentives: Incentive[],
): Incentive[] {
  // First pass: filter on appliesTo + status (no cap check yet).
  const matched = incentives.filter((inc) => {
    if (inc.status === "ended") return false;
    const a = inc.appliesTo;
    if (a) {
      if (a.models && !a.models.includes(unit.model)) return false;
      if (a.trims && !a.trims.includes(unit.trim)) return false;
      if (a.years && !a.years.includes(unit.year)) return false;
      if (a.provinces && !a.provinces.includes(dealer.province)) return false;
    }
    return true;
  });

  // Second pass: drop incentives that fail the post-OEM-cash transaction-
  // value cap. Computed once over the matched set.
  const adjustedPreTax = effectivePreTaxValue(unit, matched);
  return matched.filter((inc) => {
    if (
      inc.transactionValueCapCad !== undefined &&
      inc.capAppliesToImported &&
      E_GMP_IS_IMPORTED &&
      adjustedPreTax > inc.transactionValueCapCad
    ) {
      return false;
    }
    return true;
  });
}

// Component scores are 0-1; the composite is a weighted average rendered as 0-100.
function priceVsMsrpScore(unit: InventoryUnit): number {
  const ratio = unit.dealerAskingPrice / unit.msrp;
  // 1.0 = exact MSRP -> 0.5; 5% below MSRP -> ~1.0; 3% above -> ~0.0
  const score = 0.5 + (1 - ratio) * 10;
  return clamp01(score);
}

function daysOnLotScore(unit: InventoryUnit): number {
  const d = unit.daysOnLot ?? 0;
  // 0 days -> 0; 60 days -> ~0.6; 120+ days -> 1.0 (very negotiable)
  return clamp01(d / 120);
}

// "Pressure" = how leverageable a dealer is for a buyer. High pressure when:
// they hold a deep cluster of similar trims and at least some are aging out.
export function dealerPressureIndex(
  unit: InventoryUnit,
  dealerUnits: InventoryUnit[],
): number {
  const sameTrim = dealerUnits.filter(
    (u) => u.model === unit.model && u.trim === unit.trim,
  );
  if (sameTrim.length === 0) return 0;
  const depth = Math.min(sameTrim.length / 4, 1); // 4+ same-trim = max depth signal
  const avgAge =
    sameTrim.reduce((s, u) => s + (u.daysOnLot ?? 0), 0) / sameTrim.length;
  const ageSignal = clamp01(avgAge / 90);
  // Equal weight; both signals must be present for a high score.
  return clamp01(0.5 * depth + 0.5 * ageSignal);
}

function incentiveStackScore(applicable: Incentive[]): number {
  if (applicable.length === 0) return 0;
  const cashTotal = applicable
    .filter((i) => i.amountCad && i.status === "active")
    .reduce((s, i) => s + (i.amountCad ?? 0), 0);
  // $0 -> 0; $10k+ stack -> 1.0
  return clamp01(cashTotal / 10000);
}

export function computeDealScore(args: {
  unit: InventoryUnit;
  dealer: Dealer;
  dealerUnits: InventoryUnit[];
  applicable: Incentive[];
}) {
  const priceVsMsrp = priceVsMsrpScore(args.unit);
  const daysOnLot = daysOnLotScore(args.unit);
  const dealerPressure = dealerPressureIndex(args.unit, args.dealerUnits);
  const incentiveStack = incentiveStackScore(args.applicable);

  // Weights chosen so that price discount and incentive stack matter most;
  // pressure and aging shift the score 10-20 points either way.
  const composite =
    priceVsMsrp * 0.35 +
    incentiveStack * 0.3 +
    dealerPressure * 0.2 +
    daysOnLot * 0.15;

  return {
    score: Math.round(composite * 100),
    breakdown: {
      priceVsMsrp: Math.round(priceVsMsrp * 100),
      daysOnLot: Math.round(daysOnLot * 100),
      dealerPressure: Math.round(dealerPressure * 100),
      incentiveStack: Math.round(incentiveStack * 100),
    },
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
