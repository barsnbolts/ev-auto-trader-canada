"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Dealer, ScoredUnit } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/constants";
import { fmtCad } from "@/lib/format";

type Props = {
  dealers: Dealer[];
  units: ScoredUnit[];
  pressureByDealer: Record<string, number>;
};

function colorFor(score: number): string {
  if (score >= 70) return "#6ee7b7";
  if (score >= 40) return "#fbbf24";
  return "#94a3b8";
}

export function DealerMap({ dealers, units, pressureByDealer }: Props) {
  const placed = useMemo(
    () => dealers.filter((d) => typeof d.lat === "number" && typeof d.lng === "number"),
    [dealers],
  );
  const unitsByDealer = useMemo(() => {
    const m = new Map<string, ScoredUnit[]>();
    for (const u of units) {
      const arr = m.get(u.dealerId) ?? [];
      arr.push(u);
      m.set(u.dealerId, arr);
    }
    return m;
  }, [units]);

  return (
    <div className="card overflow-hidden">
      <MapContainer
        center={[56, -96]}
        zoom={4}
        style={{ height: "calc(100vh - 200px)", minHeight: 480, width: "100%", background: "#0b1220" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {placed.map((d) => {
          const score = pressureByDealer[d.id] ?? 0;
          const dealerUnits = unitsByDealer.get(d.id) ?? [];
          const radius = Math.max(6, Math.min(16, 6 + dealerUnits.length));
          return (
            <CircleMarker
              key={d.id}
              center={[d.lat as number, d.lng as number]}
              radius={radius}
              pathOptions={{
                color: colorFor(score),
                fillColor: colorFor(score),
                fillOpacity: 0.6,
                weight: 1.5,
              }}
            >
              <Popup>
                <div style={{ minWidth: 220 }}>
                  <a
                    href={`/dealer/${d.id}`}
                    style={{ fontWeight: 600, color: "#22c55e", textDecoration: "none" }}
                  >
                    {d.name} →
                  </a>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {d.city}, {d.province} · pressure {score}
                  </div>
                  {dealerUnits.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>No units in stock.</div>
                  ) : (
                    <ul style={{ fontSize: 12, marginTop: 6, paddingLeft: 0, listStyle: "none" }}>
                      {dealerUnits.slice(0, 8).map((u) => (
                        <li key={u.id} style={{ borderTop: "1px solid #e2e8f0", padding: "4px 0" }}>
                          <div>
                            {MODEL_LABEL[u.model]} {u.year} {u.trim}
                          </div>
                          <div style={{ color: "#64748b" }}>
                            {fmtCad(u.dealerAskingPrice)} ask · {fmtCad(u.otdCad)} OTD · {u.daysOnLot ?? "—"}d
                          </div>
                        </li>
                      ))}
                      {dealerUnits.length > 8 && (
                        <li style={{ color: "#94a3b8", paddingTop: 4 }}>+{dealerUnits.length - 8} more</li>
                      )}
                    </ul>
                  )}
                  {d.inventoryUrl && (
                    <a
                      href={d.inventoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: "#22c55e", display: "inline-block", marginTop: 6 }}
                    >
                      View inventory →
                    </a>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="px-4 py-2 border-t border-border text-xxs text-fg-subtle flex flex-wrap gap-4">
        <span>{placed.length} dealers placed{dealers.length > placed.length ? ` (${dealers.length - placed.length} missing coords)` : ""}</span>
        <span className="flex items-center gap-1">
          <span style={{ width: 10, height: 10, borderRadius: 5, background: "#6ee7b7", display: "inline-block" }} /> high pressure (≥70)
        </span>
        <span className="flex items-center gap-1">
          <span style={{ width: 10, height: 10, borderRadius: 5, background: "#fbbf24", display: "inline-block" }} /> medium (40–69)
        </span>
        <span className="flex items-center gap-1">
          <span style={{ width: 10, height: 10, borderRadius: 5, background: "#94a3b8", display: "inline-block" }} /> low (&lt;40)
        </span>
      </div>
    </div>
  );
}
