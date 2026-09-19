import { Mesh } from "three";
import { describe, expect, it } from "vitest";
import { defaultMass } from "@/schema/defaults";
import type { Point } from "@/schema/project";
import { buildMass } from "./mass";
import { layoutRoof } from "./roof";

const rect: Point[] = [
  [0, 0],
  [40, 0],
  [40, 24],
  [0, 24],
];
const ell: Point[] = [
  [0, 0],
  [40, 0],
  [40, 12],
  [20, 12],
  [20, 24],
  [0, 24],
];

describe("layoutRoof", () => {
  it("gable: two planes, two gable ends, ridge = top + run x pitch", () => {
    const r = layoutRoof(rect, 0, 10, { type: "gable", pitch: 6, ridgeAxisDeg: 0, overhangFt: 1 });
    expect(r.planes).toHaveLength(2);
    expect(r.walls).toHaveLength(2);
    expect(r.peakFt).toBeCloseTo(10 + 12 * 0.5);
    expect(r.note).toBeNull();
    // eave drops below the wall top by overhang x pitch
    const eaveY = Math.min(...r.planes.flatMap((p) => p.vertices.map((v) => v[1])));
    expect(eaveY).toBeCloseTo(10 - 0.5);
  });
  it("hip: four planes and a shortened ridge", () => {
    const r = layoutRoof(rect, 0, 10, { type: "hip", pitch: 6, ridgeAxisDeg: 0, overhangFt: 1 });
    expect(r.planes).toHaveLength(4);
    expect(r.walls).toHaveLength(0);
    // eave half extents 21 x 13 -> peak = eave + 13 x 0.5
    expect(r.peakFt).toBeCloseTo(10 - 0.5 + 13 * 0.5);
  });
  it("shed: one plane sloping along the axis, three infill walls", () => {
    const r = layoutRoof(rect, 0, 10, { type: "shed", pitch: 3, ridgeAxisDeg: 0, overhangFt: 0 });
    expect(r.planes).toHaveLength(1);
    expect(r.walls).toHaveLength(3);
    expect(r.peakFt).toBeCloseTo(10 + 40 * 0.25);
  });
  it("flat: caps the footprint; non-rectangles fall back to flat with a note", () => {
    expect(layoutRoof(ell, 0, 10, { type: "flat", pitch: 0, ridgeAxisDeg: 0, overhangFt: 1 }).note).toBeNull();
    const r = layoutRoof(ell, 0, 10, { type: "hip", pitch: 6, ridgeAxisDeg: 0, overhangFt: 1 });
    expect(r.planes).toHaveLength(1);
    expect(r.note).toMatch(/rectangular/);
  });
  it("respects base elevation", () => {
    const r = layoutRoof(rect, 2, 10, { type: "gable", pitch: 6, ridgeAxisDeg: 0, overhangFt: 0 });
    expect(r.peakFt).toBeCloseTo(18);
  });
});

describe("buildMass", () => {
  it("produces walls plus roof meshes", () => {
    const g = buildMass(defaultMass(rect));
    expect(g.children.filter((o) => o instanceof Mesh)).toHaveLength(1 + 4); // walls + hip planes
    expect(g.children[0]?.name).toBe("walls");
  });
  it("defaults an L-shape to flat", () => {
    const m = defaultMass(ell);
    expect(m.roof.type).toBe("flat");
    expect(buildMass(m).children).toHaveLength(2);
  });
});
