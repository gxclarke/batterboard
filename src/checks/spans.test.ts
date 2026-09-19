import { describe, expect, it } from "vitest";
import { maxBeamSpanFt, maxRafterSpanFt } from "./spans";

describe("span tables", () => {
  it("rafters get shorter with wider spacing and longer with deeper members", () => {
    expect(maxRafterSpanFt("2x8", 24)).toBeLessThan(maxRafterSpanFt("2x8", 16));
    expect(maxRafterSpanFt("2x8", 24)).toBeLessThan(maxRafterSpanFt("2x10", 24));
    expect(maxRafterSpanFt("2x8", 24)).toBeCloseTo(13.9);
  });
  it("beams: interpolates on tributary and scales with plies", () => {
    expect(maxBeamSpanFt("2x10", 2, 6)).toBeCloseTo(10.35 * 1.25);
    expect(maxBeamSpanFt("2x10", 2, 11)).toBeCloseTo(((8.0 + 7.35) / 2) * 1.25);
    expect(maxBeamSpanFt("2x10", 3, 11)).toBeGreaterThan(maxBeamSpanFt("2x10", 2, 11));
    expect(maxBeamSpanFt("2x10", 1, 11)).toBeLessThan(maxBeamSpanFt("2x10", 2, 11));
  });
  it("beams: beyond the table, spans keep shrinking", () => {
    expect(maxBeamSpanFt("2x12", 2, 24)).toBeLessThan(maxBeamSpanFt("2x12", 2, 18));
  });
  it("solid and engineered sections rank sensibly", () => {
    expect(maxBeamSpanFt("6x10", 1, 11)).toBeGreaterThan(maxBeamSpanFt("4x10", 1, 11));
    expect(maxBeamSpanFt("lvl", 2, 11)).toBeGreaterThan(maxBeamSpanFt("2x12", 3, 11));
  });
});
