import { describe, expect, it } from "vitest";

import { fmtCad, fmtDate, fmtPercent, relativeDays } from "./format";

describe("fmtCad", () => {
  it("formats whole CAD by default (no cents)", () => {
    const out = fmtCad(50_000);
    // en-CA + CAD → "$50,000.00" or "CA$50,000" depending on ICU version.
    // The currency formatter strips fractional digits when cents flag is off.
    expect(out).toMatch(/50,000/);
    expect(out).not.toMatch(/\.00/);
  });

  it("with cents flag shows 2 decimal places", () => {
    const out = fmtCad(50_000.5, { cents: true });
    expect(out).toMatch(/50,000\.50/);
  });

  it("rounds non-cents output to whole dollars", () => {
    const out = fmtCad(123_456.78);
    expect(out).toMatch(/123,457/);
    expect(out).not.toMatch(/\./);
  });

  it("handles zero", () => {
    const out = fmtCad(0);
    expect(out).toMatch(/0/);
  });

  it("handles negative numbers", () => {
    const out = fmtCad(-1500);
    // ICU may render as "-$1,500" or "($1,500)" depending on locale data
    expect(out).toMatch(/1,500/);
  });
});

describe("fmtPercent", () => {
  it("default is 2 decimal places", () => {
    expect(fmtPercent(7.5)).toBe("7.50%");
  });

  it("digits=0 rounds to integer", () => {
    expect(fmtPercent(7.5, 0)).toBe("8%");
  });

  it("digits=4 keeps 4 decimals", () => {
    expect(fmtPercent(0.123_45, 4)).toBe("0.1235%");
  });

  it("handles zero", () => {
    expect(fmtPercent(0)).toBe("0.00%");
  });

  it("handles negative percentages", () => {
    expect(fmtPercent(-1.5)).toBe("-1.50%");
  });
});

describe("fmtDate", () => {
  it("renders ISO timestamp as en-CA short-month date", () => {
    // Should contain the year, month abbreviation, and day.
    const out = fmtDate("2026-05-04T12:00:00Z");
    expect(out).toMatch(/2026/);
    expect(out).toMatch(/May|05/);
  });

  it("handles ISO date-only string", () => {
    const out = fmtDate("2025-01-15");
    expect(out).toMatch(/2025/);
    expect(out).toMatch(/Jan|01/);
  });
});

describe("relativeDays", () => {
  it("returns 'today' for the current moment", () => {
    expect(relativeDays(new Date().toISOString())).toBe("today");
  });

  it("returns 'today' for a few hours ago", () => {
    const fewHoursAgo = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(relativeDays(fewHoursAgo)).toBe("today");
  });

  it("returns '1 day ago' for ~25 hours ago", () => {
    const yesterday = new Date(Date.now() - 25 * 3600_000).toISOString();
    expect(relativeDays(yesterday)).toBe("1 day ago");
  });

  it("returns 'N days ago' for under 30 days", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect(relativeDays(tenDaysAgo)).toBe("10 days ago");
  });

  it("returns '1 month ago' at 30-59 days", () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 86_400_000).toISOString();
    expect(relativeDays(fortyDaysAgo)).toBe("1 month ago");
  });

  it("returns 'N months ago' beyond 60 days", () => {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
    expect(relativeDays(ninetyDaysAgo)).toBe("3 months ago");
  });

  it("treats future dates as 'today' (clamps negative diff)", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(relativeDays(tomorrow)).toBe("today");
  });
});
