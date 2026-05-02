import type { CitedValue } from "../types";

export const cad = (v: number | null | undefined): string =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0,
      }).format(v);

export const km = (v: number | null | undefined): string =>
  v == null ? "—" : `${Math.round(v).toLocaleString("en-CA")} km`;

export const kwh = (v: number | null | undefined): string =>
  v == null ? "—" : `${v.toFixed(1)} kWh`;

export const kw = (v: number | null | undefined): string =>
  v == null ? "—" : `${Math.round(v)} kW`;

export const kg = (v: number | null | undefined): string =>
  v == null ? "—" : `${Math.round(v).toLocaleString("en-CA")} kg`;

export const litres = (v: number | null | undefined): string =>
  v == null ? "—" : `${Math.round(v).toLocaleString("en-CA")} L`;

/** Extract value from a CitedValue, rendering "—" for null. */
export const cv = <T,>(c: CitedValue<T> | null | undefined): T | null =>
  c?.value ?? null;

const DRIVETRAIN_LABELS: Record<string, string> = {
  AWD: "All-wheel drive",
  SINGLE_MOTOR: "Single motor (RWD/FWD)",
};

export const drivetrain = (v: string): string =>
  DRIVETRAIN_LABELS[v] ?? v;
