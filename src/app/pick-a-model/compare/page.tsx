// /pick-a-model/compare — side-by-side spec comparison for models chosen in
// the picker tray. Driven by ?ids= URL param (comma-separated pickerKeys).
//
// pickerKey format: model|year|trim|drivetrain
// Example: ?ids=Ioniq5%7C2025%7CPreferred%20RWD%20LR%7CRWD,EV6%7C2024%7CLight%7CRWD
//
// This is the MODEL-level compare (pre-purchase research, spec-to-spec).
// The separate /compare page does UNIT-level compare (picked from inventory).

import Link from "next/link";
import { loadSpecs } from "@/lib/data";
import { readNumeric, readHeatPump } from "@/lib/types";
import { MODEL_BRAND, MODEL_LABEL } from "@/lib/constants";
import type { Spec } from "@/lib/types";
import type { Model } from "@/lib/constants";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ ids?: string }> };

function fmt(n: number | null | undefined, suffix: string): string {
  if (n == null) return "—";
  return `${n.toLocaleString("en-CA")}${suffix}`;
}

function parseIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean)
    .slice(0, 4);
}

function findSpec(specs: Spec[], id: string): Spec | null {
  const parts = id.split("|");
  if (parts.length < 4) return null;
  const [model, yearStr, trim, drivetrain] = parts;
  const year = parseInt(yearStr, 10);
  return (
    specs.find(
      (s) =>
        s.model === model &&
        s.year === year &&
        s.trim === trim &&
        s.drivetrain === drivetrain,
    ) ?? null
  );
}

interface Row {
  label: string;
  values: (string | null)[];
  highlight?: "low" | "high";
}

function buildRows(selected: (Spec | null)[]): Row[] {
  const rangeKms = selected.map((s) => {
    if (!s) return null;
    return s.rangeEpaKm ? readNumeric(s.rangeEpaKm) : s.rangeKm ?? null;
  });

  const batteryKwhs = selected.map((s) => {
    if (!s) return null;
    if (s.batteryKwhUsable) return readNumeric(s.batteryKwhUsable);
    if (typeof s.batteryKwh === "number") return s.batteryKwh;
    if (s.batteryKwh != null) return readNumeric(s.batteryKwh as Parameters<typeof readNumeric>[0]);
    return null;
  });

  const dcKws = selected.map((s) => {
    if (!s) return null;
    return s.dcChargeMaxKw ? readNumeric(s.dcChargeMaxKw) : s.dcFastChargeKw ?? null;
  });

  return [
    {
      label: "Year",
      values: selected.map((s) => (s ? String(s.year) : null)),
    },
    {
      label: "Powertrain",
      values: selected.map((s) => s?.powertrain ?? null),
    },
    {
      label: "Body style",
      values: selected.map((s) => s?.bodyStyle ?? null),
    },
    {
      label: "Drivetrain",
      values: selected.map((s) => s?.drivetrain ?? null),
    },
    {
      label: "EPA range",
      values: rangeKms.map((r) => fmt(r, " km")),
      highlight: "high",
    },
    {
      label: "Battery (usable)",
      values: batteryKwhs.map((b) => fmt(b, " kWh")),
      highlight: "high",
    },
    {
      label: "DC charge (peak)",
      values: dcKws.map((d) => fmt(d, " kW")),
      highlight: "high",
    },
    {
      label: "AC charge",
      values: selected.map((s) => {
        const kw = s?.acChargeMaxKw ? readNumeric(s.acChargeMaxKw) : s?.acChargeKw ?? null;
        return fmt(kw, " kW");
      }),
      highlight: "high",
    },
    {
      label: "Motor output",
      values: selected.map((s) => {
        if (!s) return null;
        const kw = s.motorKw;
        const hp = s.motorHp ?? (kw != null ? Math.round(kw * 1.341) : undefined);
        if (kw != null && hp != null) return `${kw} kW / ${hp} hp`;
        if (kw != null) return `${kw} kW`;
        return null;
      }),
    },
    {
      label: "0-100 km/h",
      values: selected.map((s) => fmt(s?.zeroToHundredSec, " s")),
      highlight: "low",
    },
    {
      label: "Seats",
      values: selected.map((s) => (s?.seats != null ? String(s.seats) : null)),
    },
    {
      label: "Cargo (seats up)",
      values: selected.map((s) => {
        const c =
          s?.cargoLitres != null
            ? typeof s.cargoLitres === "number"
              ? s.cargoLitres
              : readNumeric(s.cargoLitres as Parameters<typeof readNumeric>[0])
            : null;
        return fmt(c, " L");
      }),
      highlight: "high",
    },
    {
      label: "Heat pump",
      values: selected.map((s) => {
        if (!s) return null;
        const hp = readHeatPump(s.hasHeatPump);
        if (hp === true) return "Yes";
        if (hp === false) return "No";
        return "?";
      }),
    },
    {
      label: "Charge port",
      values: selected.map((s) => s?.portType?.replace("_ONLY", "") ?? null),
    },
    {
      label: "Battery chemistry",
      values: selected.map((s) => s?.batteryChemistry ?? null),
    },
    {
      label: "Thermal mgmt",
      values: selected.map((s) =>
        s?.thermalManagement?.replace(/_/g, " ") ?? null,
      ),
    },
    {
      label: "MSRP",
      values: selected.map((s) =>
        s?.msrpCad != null ? `$${s.msrpCad.toLocaleString("en-CA")}` : null,
      ),
      highlight: "low",
    },
    {
      label: "Freight & PDI",
      values: selected.map((s) =>
        s?.freightPdiCad != null
          ? `$${s.freightPdiCad.toLocaleString("en-CA")}`
          : null,
      ),
    },
  ];
}

function bestIndices(values: (string | null)[], highlight: "low" | "high"): Set<number> {
  const nums = values.map((v) => {
    if (!v || v === "—") return null;
    const n = parseFloat(v.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  });
  const valid = nums.filter((n): n is number => n !== null);
  if (valid.length < 2) return new Set();
  const best = highlight === "high" ? Math.max(...valid) : Math.min(...valid);
  return new Set(nums.map((n, i) => (n === best ? i : -1)).filter((i) => i >= 0));
}

export default async function PickerComparePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawIds = sp.ids ?? "";
  const ids = parseIds(rawIds);

  if (ids.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Compare models</h1>
        <div className="card p-8 text-center space-y-2">
          <p className="text-fg-muted">No models selected.</p>
          <Link href="/pick-a-model" className="text-accent hover:text-accent-strong text-sm">
            Back to picker
          </Link>
        </div>
      </div>
    );
  }

  const specs = await loadSpecs();
  const selected = ids.map((id) => findSpec(specs, id));
  const found = selected.filter((s): s is Spec => s !== null);

  if (found.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Compare models</h1>
        <div className="card p-8 text-center space-y-2">
          <p className="text-fg-muted">No matching specs found.</p>
          <Link href="/pick-a-model" className="text-accent hover:text-accent-strong text-sm">
            Back to picker
          </Link>
        </div>
      </div>
    );
  }

  const rows = buildRows(selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compare models</h1>
          <p className="text-sm text-fg-muted">
            {found.length} model{found.length === 1 ? "" : "s"} selected
          </p>
        </div>
        <Link href="/pick-a-model" className="text-xs text-accent hover:text-accent-strong">
          Back to picker
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xxs uppercase tracking-wide text-fg-subtle w-36">
                Spec
              </th>
              {selected.map((s, i) =>
                s ? (
                  <th key={i} className="px-4 py-3 text-left">
                    <div className="text-xxs uppercase tracking-wide text-fg-subtle">
                      {MODEL_BRAND[s.model as Model]}
                    </div>
                    <div className="font-semibold text-fg leading-tight">{MODEL_LABEL[s.model as Model]}</div>
                    <div className="text-xxs text-fg-subtle mt-0.5">
                      {s.year} {s.trim}
                    </div>
                    <div className="text-xxs text-fg-subtle">{s.drivetrain}</div>
                    <a
                      href={`/inventory?model=${encodeURIComponent(s.model)}&trim=${encodeURIComponent(s.trim)}`}
                      className="inline-block mt-1.5 px-2 py-0.5 rounded text-xxs bg-accent text-bg hover:opacity-90 transition"
                    >
                      Buy this trim
                    </a>
                  </th>
                ) : (
                  <th key={i} className="px-4 py-3 text-left text-fg-subtle italic text-xs">
                    Not found
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const best = row.highlight ? bestIndices(row.values, row.highlight) : new Set<number>();
              return (
                <tr key={row.label} className="border-t border-border hover:bg-bg-hover/40 transition">
                  <td className="px-4 py-2.5 text-xxs uppercase tracking-wide text-fg-subtle align-top">
                    {row.label}
                  </td>
                  {row.values.map((val, i) => {
                    const isBest = best.has(i);
                    const isEmpty = !val || val === "—";
                    return (
                      <td
                        key={i}
                        className={`px-4 py-2.5 num align-top ${
                          isBest
                            ? "text-good font-medium"
                            : isEmpty
                            ? "text-fg-subtle"
                            : "text-fg"
                        }`}
                      >
                        {val ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xxs text-fg-subtle">
        Green = best in comparison. Range is EPA-rated; real-world varies by temperature and driving style.{" "}
        <Link href="/pick-a-model" className="text-accent hover:text-accent-strong">
          Modify selection
        </Link>
      </p>
    </div>
  );
}
