import { ON_DEALER_FEES, PROVINCE_TAX, bcPstRateFor } from "./constants";
import type { Dealer, Incentive, InventoryUnit, ScoredUnit } from "./types";

// E-GMP cars are assembled in Korea (and US for some Ioniq 5 trims) so they
// are NOT Canadian-made. EVAP cap applies in full to every unit we track.
const E_GMP_IS_IMPORTED = true;

// Pre-tax transaction value used for cap eligibility. Excludes sales tax
// (matches Transport Canada's EVAP rule).
function preTaxTransactionValue(unit: InventoryUnit): number {
  return (
    unit.dealerAskingPrice +
    unit.freightPdi +
    ON_DEALER_FEES.airConditioningExciseTax
  );
}

export function evapEligibleAmount(unit: InventoryUnit, evap: Incentive | undefined): number {
  if (!evap || evap.status !== "active") return 0;
  const cap = evap.transactionValueCapCad;
  if (cap !== undefined && evap.capAppliesToImported && E_GMP_IS_IMPORTED) {
    if (preTaxTransactionValue(unit) > cap) return 0;
  }
  // Cash/finance/48mo+ lease assumption (default in the dashboard view).
  return evap.leaseTermProration?.["48"] ?? evap.amountCad ?? 0;
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
// EVAP rebate is subtracted from the OTD when the unit qualifies (per-unit
// transaction-value test). Sales tax stacks on top of the pre-tax base
// (vehicle + freight + AC excise) per CRA guidance; OMVIC, RDPRM, tire
// stewardship, and licensing are typically post-tax line items.
export function computeOtd(
  unit: InventoryUnit,
  dealer: Dealer,
  applicable: Incentive[] = [],
): ScoredUnit["otdBreakdown"] {
  const dealerAdjustment = unit.dealerAskingPrice - unit.msrp;
  const preTaxBase = preTaxTransactionValue(unit);
  const salesTax = salesTaxFor(dealer.province, preTaxBase, unit.dealerAskingPrice);

  const evap = applicable.find((i) => i.id.startsWith("fed-evap"));
  const evapRebate = evapEligibleAmount(unit, evap);

  const total =
    preTaxBase +
    salesTax +
    ON_DEALER_FEES.rdprmFee +
    ON_DEALER_FEES.omvicFee +
    ON_DEALER_FEES.tireStewardshipFee +
    ON_DEALER_FEES.govLicensingEstimate -
    evapRebate;

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
    total: +total.toFixed(2),
  };
}

// Filter incentives down to ones that match this unit + dealer. Used both
// for the deal-score stack term and for the per-unit detail panel. EVAP
// transaction-value cap is enforced here so over-cap units don't show the
// rebate as "applicable."
export function applicableIncentives(
  unit: InventoryUnit,
  dealer: Dealer,
  incentives: Incentive[],
): Incentive[] {
  return incentives.filter((inc) => {
    if (inc.status === "ended") return false;
    const a = inc.appliesTo;
    if (a) {
      if (a.models && !a.models.includes(unit.model)) return false;
      if (a.trims && !a.trims.includes(unit.trim)) return false;
      if (a.years && !a.years.includes(unit.year)) return false;
      if (a.provinces && !a.provinces.includes(dealer.province)) return false;
    }
    // EVAP cap: drop the rebate from "applicable" if this unit is over the
    // cap. Keeps the inventory-row chip honest and prevents the deal-score
    // stack term from inflating for over-cap units.
    if (
      inc.transactionValueCapCad !== undefined &&
      inc.capAppliesToImported &&
      E_GMP_IS_IMPORTED
    ) {
      if (preTaxTransactionValue(unit) > inc.transactionValueCapCad) return false;
    }
    return true;
  });
}

// Helper exposed for UI: how far over the cap is this unit (0 if eligible)?
export function evapCapDeltaCad(unit: InventoryUnit, evap: Incentive | undefined): number {
  if (!evap || evap.transactionValueCapCad === undefined) return 0;
  const delta = preTaxTransactionValue(unit) - evap.transactionValueCapCad;
  return delta > 0 ? +delta.toFixed(2) : 0;
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
