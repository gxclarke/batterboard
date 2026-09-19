import { describe, expect, it } from "vitest";
import { lumber } from "./lumber";

describe("lumber", () => {
  it("maps nominal to actual inches", () => {
    expect(lumber("2x8")).toMatchObject({ thicknessIn: 1.5, depthIn: 7.25 });
    expect(lumber("6x6")).toMatchObject({ thicknessIn: 5.5, depthIn: 5.5 });
    expect(lumber("4x10")).toMatchObject({ thicknessIn: 3.5, depthIn: 9.25 });
    expect(lumber("2x12").depthFt).toBeCloseTo(11.25 / 12);
  });
  it("orders thickness before depth regardless of input order", () => {
    expect(lumber("10x2")).toMatchObject({ thicknessIn: 1.5, depthIn: 9.25 });
  });
  it("knows LVL", () => {
    expect(lumber("lvl")).toMatchObject({ thicknessIn: 1.75, depthIn: 11.875 });
  });
  it("rejects nonsense", () => {
    expect(() => lumber("2x7")).toThrow();
    expect(() => lumber("big")).toThrow();
  });
});
