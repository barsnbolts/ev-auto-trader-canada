import { ON_DEALER_FEES, PROVINCE_TAX } from "./constants";
import type { Dealer, Incentive, InventoryUnit, ScoredUnit } from "./types";

// True out-the-door math for a single unit. The buyer-relevant total.
// Tax is applied to (vehicle + freight + AC tax) per CRA guidance; OMVIC,
// RDPRM, tire stewardship, and licensing are typically post-tax fees.
export function computeOtd(unit: InventoryUnit, dealer: Dealer): ScoredUnit["otdBreakdown"] {
  const taxRate = PROVINCE_TAX[dealer.province];
  const dealerAdjustment = unit.dealerAskingPrice - unit.msrp;

  const preTaxBase = unit.dealerAskingPrice + unit.freightPdi + ON_DEALER_FEES.airConditioningExciseTax;
  const salesTax = +(preTaxBase * taxRate).toFixed(2);

  const total =
    preTaxBase +
    salesTax +
    ON_DEALER_FEES.rdprmFee +
    ON_DEALER_FEES.omvicFee +
    ON_DEALER_FEES.tireStewardshipFee +
    ON_DEALER_FEES.govLicensingEstimate;

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
// for the deal-score stack term and for the per-unit detail panel.
export function applicableIncentives(
  unit: InventoryUnit,
  dealer: Dealer,
  incentives: Incentive[],
): Incentive[] {
  return incentives.filter((inc) => {
    if (inc.status === "ended") return false;
    const a = inc.appliesTo;
    if (!a) return true;
    if (a.models && !a.models.includes(unit.model)) return false;
    if (a.trims && !a.trims.includes(unit.trim)) return false;
    if (a.years && !a.years.includes(unit.year)) return false;
    if (a.provinces && !a.provinces.includes(dealer.province)) return false;
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
