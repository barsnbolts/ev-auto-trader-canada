import { describe, expect, it } from "vitest";

import { usedListingsFor } from "./usedListingsLinks";

describe("usedListingsFor — AutoTrader URL construction", () => {
  it("Ioniq5 ON uses /cars/hyundai/ioniq+5/on/ path", () => {
    const links = usedListingsFor("Ioniq5", "ON");
    expect(links.autoTrader).toBe(
      "https://www.autotrader.ca/cars/hyundai/ioniq+5/on/?rcp=20&rcs=0&sts=Used",
    );
  });

  it("EV6 BC uses /cars/kia/ev6/bc/ path", () => {
    const links = usedListingsFor("EV6", "BC");
    expect(links.autoTrader).toContain("/cars/kia/ev6/bc/");
    expect(links.autoTrader).toContain("sts=Used");
  });

  it("Ioniq9 picks hyundai make slug", () => {
    const links = usedListingsFor("Ioniq9", "AB");
    expect(links.autoTrader).toContain("/cars/hyundai/ioniq+9/ab/");
  });

  it("EV9 picks kia make slug", () => {
    const links = usedListingsFor("EV9", "QC");
    expect(links.autoTrader).toContain("/cars/kia/ev9/qc/");
  });

  it("URL is lowercase province code", () => {
    const links = usedListingsFor("Ioniq6", "NS");
    expect(links.autoTrader).toContain("/ns/");
    expect(links.autoTrader).not.toContain("/NS/");
  });
});

describe("usedListingsFor — Kijiji URL construction", () => {
  it("Ioniq5 ON uses ontario slug + a54 make code", () => {
    const links = usedListingsFor("Ioniq5", "ON");
    expect(links.kijiji).toContain("/ontario/");
    expect(links.kijiji).toContain("ioniq-5");
    expect(links.kijiji).toContain("hyundai");
    expect(links.kijiji).toContain("a54");
    expect(links.kijiji).toContain("l9004");
  });

  it("EV6 QC uses quebec slug + a64 make code (verified separate from a54)", () => {
    const links = usedListingsFor("EV6", "QC");
    expect(links.kijiji).toContain("/quebec/");
    expect(links.kijiji).toContain("a64");
    expect(links.kijiji).not.toContain("a54");
  });

  it("uses kebab-case model keyword (ioniq-5, not ioniq5)", () => {
    const links = usedListingsFor("Ioniq5", "AB");
    expect(links.kijiji).toContain("ioniq-5");
    expect(links.kijiji).not.toContain("ioniq5");
  });

  it("Yukon uses yukon + l9012 location codes", () => {
    const links = usedListingsFor("Ioniq6", "YT");
    expect(links.kijiji).toContain("/yukon/");
    expect(links.kijiji).toContain("l9012");
  });
});

describe("usedListingsFor — Leasebusters", () => {
  it("returns the manual-search base URL (no deep-link supported)", () => {
    const links = usedListingsFor("Ioniq5", "ON");
    expect(links.leasebusters).toBe(
      "https://www.leasebusters.com/vehicle-search/Leasing",
    );
  });

  it("flags leasebustersIsManualSearch=true so UI shows tooltip", () => {
    const links = usedListingsFor("EV9", "BC");
    expect(links.leasebustersIsManualSearch).toBe(true);
  });

  it("Leasebusters URL is province-agnostic", () => {
    const a = usedListingsFor("Ioniq5", "ON").leasebusters;
    const b = usedListingsFor("Ioniq5", "QC").leasebusters;
    expect(a).toBe(b);
  });
});

describe("usedListingsFor — return shape", () => {
  it("returns all four expected fields", () => {
    const links = usedListingsFor("Ioniq5", "ON");
    expect(Object.keys(links).sort()).toEqual(
      ["autoTrader", "kijiji", "leasebusters", "leasebustersIsManualSearch"].sort(),
    );
  });

  it("all URLs are https", () => {
    const links = usedListingsFor("EV6", "ON");
    expect(links.autoTrader).toMatch(/^https:\/\//);
    expect(links.kijiji).toMatch(/^https:\/\//);
    expect(links.leasebusters).toMatch(/^https:\/\//);
  });
});
