import { describe, it, expect } from "vitest";
import { TERM, POWERTRAIN_PLAIN, PROTOCOL_PLAIN, resolve } from "./labels";

describe("TERM dictionary", () => {
  it("BEV powertrain has correct plain label", () => {
    expect(POWERTRAIN_PLAIN["BEV"]).toBe("Electric only");
  });
  it("PHEV powertrain has correct plain label", () => {
    expect(POWERTRAIN_PLAIN["PHEV"]).toBe("Plug-in hybrid");
  });
  it("EPA has correct plain label", () => {
    expect(PROTOCOL_PLAIN["EPA"]).toBe("Government test");
  });
  it("range geek label is Range", () => {
    expect(TERM.range.geek).toBe("Range");
    expect(TERM.range.plain).toBe("Estimated distance");
  });
  it("msrp geek label is MSRP", () => {
    expect(TERM.msrp.geek).toBe("MSRP");
    expect(TERM.msrp.plain).toBe("Starting price");
  });
});

describe("resolve()", () => {
  it("returns plain when plainMode=true", () => {
    expect(resolve(TERM.range, true)).toBe("Estimated distance");
  });
  it("returns geek when plainMode=false", () => {
    expect(resolve(TERM.range, false)).toBe("Range");
  });
  it("passes through plain strings unchanged", () => {
    expect(resolve("Static label", true)).toBe("Static label");
    expect(resolve("Static label", false)).toBe("Static label");
  });
});
