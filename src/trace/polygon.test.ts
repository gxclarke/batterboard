import { describe, expect, it } from "vitest";
import type { Point } from "@/schema/project";
import {
  area,
  centroid,
  chainWouldCross,
  isSimplePolygon,
  longestEdgeDeg,
  pointInPolygon,
  rectCorners,
  rectFrame,
  rectFromEdgeAndPoint,
  segmentsIntersect,
} from "./polygon";

const square: Point[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
];
const bowtie: Point[] = [
  [0, 0],
  [10, 10],
  [10, 0],
  [0, 10],
];

describe("polygon", () => {
  it("area and centroid", () => {
    expect(area(square)).toBe(100);
    expect(centroid(square)).toEqual([5, 5]);
  });
  it("segment intersection", () => {
    expect(segmentsIntersect([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
    expect(segmentsIntersect([0, 0], [10, 0], [0, 1], [10, 1])).toBe(false);
    expect(segmentsIntersect([0, 0], [10, 0], [5, 0], [5, 5])).toBe(true); // touching
  });
  it("detects a crossing while tracing", () => {
    const chain: Point[] = [
      [0, 0],
      [10, 0],
      [10, 10],
    ];
    expect(chainWouldCross(chain, [5, -5])).toBe(true);
    expect(chainWouldCross(chain, [0, 10])).toBe(false);
  });
  it("simple polygon check", () => {
    expect(isSimplePolygon(square)).toBe(true);
    expect(isSimplePolygon(bowtie)).toBe(false);
    expect(
      isSimplePolygon([
        [0, 0],
        [1, 0],
      ]),
    ).toBe(false);
  });
  it("point in polygon", () => {
    expect(pointInPolygon([5, 5], square)).toBe(true);
    expect(pointInPolygon([15, 5], square)).toBe(false);
  });
  it("rectangle from an edge and a depth point", () => {
    const r = rectFromEdgeAndPoint([0, 0], [10, 0], [3, 4]);
    expect(r[2]).toEqual([10, 4]);
    expect(r[3]).toEqual([0, 4]);
    const r2 = rectFromEdgeAndPoint([0, 0], [10, 0], [3, -4]);
    expect(r2[2][1]).toBeCloseTo(-4);
  });
  it("rectangle corners from center and rotation", () => {
    const r = rectCorners([0, 0], 0, 20, 10);
    expect(r[0]).toEqual([-10, -5]);
    expect(r[2]).toEqual([10, 5]);
    const r90 = rectCorners([0, 0], 90, 20, 10);
    expect(r90[0][0]).toBeCloseTo(5);
    expect(r90[0][1]).toBeCloseTo(-10);
  });
  it("rect frame picks the edge nearest the axis", () => {
    const rect: Point[] = [
      [0, 0],
      [30, 0],
      [30, 12],
      [0, 12],
    ];
    const f = rectFrame(rect, 0);
    expect(f).not.toBeNull();
    expect(f?.hu).toBe(15);
    expect(f?.hv).toBe(6);
    expect(f?.c).toEqual([15, 6]);
    const g = rectFrame(rect, 90);
    expect(g?.hu).toBe(6);
    expect(g?.hv).toBe(15);
    expect(rectFrame(bowtie, 0)).toBeNull();
    expect(
      rectFrame(
        [
          [0, 0],
          [10, 0],
          [12, 8],
          [0, 8],
        ],
        0,
      ),
    ).toBeNull();
  });
  it("longest edge bearing", () => {
    expect(
      longestEdgeDeg([
        [0, 0],
        [30, 0],
        [30, 12],
        [0, 12],
      ]),
    ).toBe(0);
    expect(
      longestEdgeDeg([
        [0, 0],
        [12, 0],
        [12, 30],
        [0, 30],
      ]),
    ).toBe(90);
  });
});
