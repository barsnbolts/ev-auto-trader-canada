// Behavior tests for WhyDrawer (F-04).
// Drawer is collapsed by default, opens on click, exposes the four levers from
// the thermal breakdown for each compared vehicle.

import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { WhyDrawer } from "./WhyDrawer";
import type { Vehicle } from "../types";
import type { ThermalOutputs } from "../lib/thermal";

function fakeVehicle(id: string, model: string): Vehicle {
  // Cast through unknown — only the fields WhyDrawer reads are populated.
  return {
    id,
    brand_id: "test",
    model,
    trim_label: "Long Range",
  } as unknown as Vehicle;
}

function fakeThermal(capFrac: number, hvacKw: number): ThermalOutputs {
  return {
    range_km: 400,
    usable_kwh: 75,
    peak_dc_kw: 150,
    efficiency_whkm: 175,
    confidence: "High",
    computationNotes: [],
    breakdown: {
      capacity_fraction: capFrac,
      hvac_kw: hvacKw,
      dc_precon_factor: 1.0,
      dc_temp_factor: 0.95,
      rated_efficiency_whkm: 165,
      temp_clamped: 20,
    },
  };
}

describe("WhyDrawer (F-04)", () => {
  const vehicles = [fakeVehicle("a", "Model A"), fakeVehicle("b", "Model B")];
  const thermals = {
    a: fakeThermal(0.95, 2.5),
    b: fakeThermal(0.88, 5.0),
  };

  it("renders the toggle button collapsed by default", () => {
    const { getByRole, queryByText } = render(
      <WhyDrawer vehicles={vehicles} thermals={thermals} />
    );
    const btn = getByRole("button", { name: /Why these numbers/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    // Lever rows not present yet
    expect(queryByText(/Battery capacity available/i)).toBeNull();
  });

  it("opens on click and shows all four levers + rated efficiency", () => {
    const { getByRole, getByText } = render(
      <WhyDrawer vehicles={vehicles} thermals={thermals} />
    );
    fireEvent.click(getByRole("button", { name: /Why these numbers/i }));
    expect(getByText(/Battery capacity available/i)).toBeInTheDocument();
    expect(getByText(/HVAC draw/i)).toBeInTheDocument();
    expect(getByText(/DC charging — preconditioning/i)).toBeInTheDocument();
    expect(getByText(/DC charging — temp factor/i)).toBeInTheDocument();
    expect(getByText(/Rated efficiency/i)).toBeInTheDocument();
  });

  it("renders a column per compared vehicle with formatted values", () => {
    const { getByRole, getByText } = render(
      <WhyDrawer vehicles={vehicles} thermals={thermals} />
    );
    fireEvent.click(getByRole("button", { name: /Why these numbers/i }));
    // Capacity fractions formatted as percentages
    expect(getByText("95%")).toBeInTheDocument();
    expect(getByText("88%")).toBeInTheDocument();
    // HVAC values formatted with kW unit
    expect(getByText("2.5 kW")).toBeInTheDocument();
    expect(getByText("5.0 kW")).toBeInTheDocument();
  });

  it("renders 'off' for HVAC when draw is zero", () => {
    const t = { a: fakeThermal(1.0, 0) };
    const { getByRole, getByText } = render(
      <WhyDrawer vehicles={[fakeVehicle("a", "Test")]} thermals={t} />
    );
    fireEvent.click(getByRole("button", { name: /Why these numbers/i }));
    expect(getByText("off")).toBeInTheDocument();
  });
});
