import type { Vehicle } from "../types";
import type { ThermalOutputs } from "../lib/thermal";
import type { Station } from "../lib/ocm";
import type { RouteResult } from "../lib/osrm";
import { planRoute } from "../lib/charge_plan";

const RING_COLORS = ["#2a7cff", "#1fb76b", "#f6a72a", "#e8453c"] as const;

export function ChargePlanPanel({
  vehicles,
  thermals,
  route,
  stations,
}: {
  vehicles: Vehicle[];
  thermals: Record<string, ThermalOutputs>;
  route: RouteResult | null;
  stations: Station[];
}) {
  if (!route) return null;

  const plans = vehicles.map((v) => ({
    vehicle: v,
    plan: planRoute(v, thermals[v.id], route, stations),
  }));

  const fastest = plans
    .filter((p) => p.plan.feasible)
    .sort((a, b) => a.plan.total_minutes - b.plan.total_minutes)[0];

  return (
    <div className="bg-ink-800 rounded-lg border border-ink-700 p-4 mb-6">
      <div className="flex items-baseline gap-4 mb-3 flex-wrap">
        <h3 className="font-display text-sm uppercase tracking-widest text-ink-300">
          Charge plan · {Math.round(route.distance_km)} km trip
        </h3>
        <span className="text-xs text-ink-500">
          simulated at current slider state · drives + stops + margin
        </span>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${plans.length}, minmax(0, 1fr))` }}>
        {plans.map(({ vehicle, plan }, i) => {
          const isFastest = fastest && fastest.vehicle.id === vehicle.id;
          const color = RING_COLORS[i % RING_COLORS.length];
          return (
            <div
              key={vehicle.id}
              className={`bg-ink-700/40 rounded p-3 text-xs border-l-2 ${isFastest ? "ring-1 ring-accent-green/50" : ""}`}
              style={{ borderLeftColor: color }}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-ink-200">{vehicle.model}</div>
                  <div className="text-ink-400">{vehicle.trim_label}</div>
                </div>
                {isFastest && (
                  <span className="text-[10px] bg-accent-green/15 text-accent-green border border-accent-green/30 rounded px-1.5 py-0.5">
                    FASTEST
                  </span>
                )}
              </div>

              {plan.feasible ? (
                <>
                  <div className="mt-2 text-ink-100 font-mono">
                    {formatMin(plan.total_minutes)}{" "}
                    <span className="text-ink-500">total</span>
                  </div>
                  <div className="text-ink-500 font-mono text-[11px]">
                    {formatMin(plan.drive_minutes)} drive + {formatMin(plan.charge_minutes)} charging
                  </div>
                  <div className="text-ink-400 mt-2 text-[11px]">
                    {plan.stops.length === 0
                      ? "No stops — one-shot."
                      : `${plan.stops.length} stop${plan.stops.length === 1 ? "" : "s"}`}
                  </div>
                  {plan.stops.map((s, idx) => (
                    <div key={idx} className="mt-2 pl-2 border-l border-ink-600 text-[11px]">
                      <div className="text-ink-300">
                        Stop {idx + 1}: {s.station.name}
                      </div>
                      <div className="text-ink-500 font-mono">
                        {Math.round(s.arrive_soc_pct)}→{Math.round(s.depart_soc_pct)}%{" "}
                        · {Math.round(s.minutes)} min · {s.station.max_kw} kW
                      </div>
                    </div>
                  ))}
                  <div className="text-[11px] text-ink-500 mt-2">{plan.note}</div>
                </>
              ) : (
                <div className="mt-2 text-accent-red text-[11px]">
                  {plan.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatMin(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}
