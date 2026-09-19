import { describe, expect, it } from "vitest";
import type { AerialTile } from "@/schema/project";
import { compositeBounds, deltaPercent, feetBetween, formatFeet, pxPerFootFrom, tileOffsetFromMatch } from "./scale";

const tile = (id: string, w: number, h: number, offset: [number, number]): AerialTile => ({
  id,
  name: id,
  blobKey: `aerial_${id}`,
  widthPx: w,
  heightPx: h,
  offsetPx: offset,
});

describe("scale math", () => {
  it("derives pixels per foot from a known dimension", () => {
    expect(pxPerFootFrom([0, 0], [90, 0], 9)).toBe(10);
    expect(pxPerFootFrom([10, 10], [40, 50], 5)).toBe(10);
  });
  it("measures feet at a scale", () => {
    expect(feetBetween([0, 0], [0, 165], 10)).toBeCloseTo(16.5);
  });
  it("computes a tile offset from one matching point", () => {
    // feature at (800, 1200) in the frame is at (100, 300) in the new tile
    expect(tileOffsetFromMatch([800, 1200], [100, 300])).toEqual([700, 900]);
  });
  it("bounds the composite, allowing negative offsets", () => {
    expect(compositeBounds([])).toBeNull();
    expect(compositeBounds([tile("a", 100, 200, [0, 0]), tile("b", 100, 200, [-50, 150])])).toEqual({
      minX: -50,
      minY: 0,
      maxX: 100,
      maxY: 350,
    });
  });
  it("reports cross-check deltas", () => {
    expect(deltaPercent(21, 20)).toBeCloseTo(5);
    expect(deltaPercent(19, 20)).toBeCloseTo(-5);
  });
  it("formats feet and inches", () => {
    expect(formatFeet(24.3)).toBe(`24' 4"`);
    expect(formatFeet(9.99)).toBe(`10' 0"`);
  });
});
