import { Mesh } from "three";
import { describe, expect, it } from "vitest";
import { defaultCarport } from "@/schema/defaults";
import { inToFt } from "../lumber";
import { buildCarport, layoutCarport, spread, stations } from "./carport";

const POST_6X6 = inToFt(5.5);
const BEAM_2X10 = inToFt(9.25);

describe("helpers", () => {
  it("spread is inclusive and even", () => {
    expect(spread(-10, 10, 3)).toEqual([-10, 0, 10]);
    expect(spread(0, 9, 4)).toEqual([0, 3, 6, 9]);
  });
  it("stations always end at the far end", () => {
    expect(stations(-11, 11, 2)).toHaveLength(12);
    expect(stations(-11, 11, 2).at(-1)).toBe(11);
    const s16 = stations(-11, 11, 16 / 12);
    expect(s16).toHaveLength(18);
    expect(s16.at(-1)).toBe(11);
  });
});

describe("layoutCarport: posts", () => {
  it("puts 2x3 posts on two rows along depth, inset by half a post", () => {
    const c = defaultCarport(); // 20 x 20, 6x6, 2 rows x 3
    const { posts } = layoutCarport(c);
    expect(posts).toHaveLength(6);
    const xs = new Set(posts.map((p) => p.center[0].toFixed(4)));
    expect(xs).toEqual(new Set([(-(10 - POST_6X6 / 2)).toFixed(4), (10 - POST_6X6 / 2).toFixed(4)]));
    const zs = [...new Set(posts.map((p) => +p.center[2].toFixed(4)))].sort((a, b) => a - b);
    expect(zs).toEqual([-(10 - POST_6X6 / 2), 0, 10 - POST_6X6 / 2].map((z) => +z.toFixed(4)));
    for (const p of posts) {
      expect(p.size[0]).toBeCloseTo(POST_6X6);
      expect(p.size[1]).toBeCloseTo(8); // plate height
      expect(p.center[1]).toBeCloseTo(4);
    }
  });

  it("supports a center row for a 3-row layout", () => {
    const { posts } = layoutCarport(defaultCarport({ posts: { ...defaultCarport().posts, countAlongWidth: 3 } }));
    expect(posts).toHaveLength(9);
    expect(posts.filter((p) => Math.abs(p.center[0]) < 1e-9)).toHaveLength(3);
    // the center row sits under the ridge and is taller
    const center = posts.find((p) => Math.abs(p.center[0]) < 1e-9);
    expect(center?.size[1]).toBeGreaterThan(8);
  });

  it("never puts posts across the open ends", () => {
    const { posts } = layoutCarport(defaultCarport({ posts: { ...defaultCarport().posts, countAlongDepth: 2 } }));
    expect(posts).toHaveLength(4);
  });

  it("shed: high row is taller by run x pitch", () => {
    const c = defaultCarport({ type: "shed", roofPitch: 3 });
    const { posts } = layoutCarport(c);
    const rows = [...new Set(posts.map((p) => p.center[0]))].sort((a, b) => a - b);
    const high = posts.find((p) => p.center[0] === rows[0]);
    const low = posts.find((p) => p.center[0] === rows[1]);
    expect(low?.size[1]).toBeCloseTo(8);
    expect(high?.size[1]).toBeCloseTo(8 + (20 - POST_6X6) * (3 / 12));
  });
});

describe("layoutCarport: beams", () => {
  it("one beam per row, full depth, plies stacked", () => {
    const { beams } = layoutCarport(defaultCarport());
    expect(beams).toHaveLength(2);
    for (const b of beams) {
      expect(b.size[0]).toBeCloseTo(2 * inToFt(1.5));
      expect(b.size[1]).toBeCloseTo(BEAM_2X10);
      expect(b.size[2]).toBeCloseTo(20);
      expect(b.center[1]).toBeCloseTo(8 + BEAM_2X10 / 2);
    }
  });
});

describe("layoutCarport: rafters", () => {
  it("gable @24in: a pair per station over depth + rakes", () => {
    const l = layoutCarport(defaultCarport()); // depth 20 + 1 ft rake each end = 22 ft
    expect(l.rafterStationsFt).toHaveLength(12);
    expect(l.members.filter((m) => m.part === "rafter")).toHaveLength(24);
    expect(l.ridge).not.toBeNull();
    expect(l.roofPlanes).toHaveLength(2);
  });

  it("gable @16in", () => {
    const l = layoutCarport(defaultCarport({ framing: { ...defaultCarport().framing, rafterSpacingIn: 16 } }));
    expect(l.rafterStationsFt).toHaveLength(18);
    expect(l.members.filter((m) => m.part === "rafter")).toHaveLength(36);
  });

  it("gable ridge height = bearing + run x pitch", () => {
    const l = layoutCarport(defaultCarport()); // 4:12, run to outer row centerline = 10 - 2.75in
    const ridgeUnderside = 8 + BEAM_2X10 + (10 - POST_6X6 / 2) * (4 / 12);
    const top = l.members.find((m) => m.part === "rafter");
    expect(top?.a[1]).toBeCloseTo(ridgeUnderside);
    expect(l.heights.peakFt).toBeGreaterThan(ridgeUnderside);
  });

  it("shed: one rafter per station, spanning eave to eave", () => {
    const l = layoutCarport(defaultCarport({ type: "shed" }));
    const rafters = l.members.filter((m) => m.part === "rafter");
    expect(rafters).toHaveLength(12);
    expect(rafters[0]?.a[0]).toBeCloseTo(-11);
    expect(rafters[0]?.b[0]).toBeCloseTo(11);
    expect(l.ridge).toBeNull();
    expect(l.roofPlanes).toHaveLength(1);
  });

  it("hip: four hips, four planes, commons only under the ridge", () => {
    const l = layoutCarport(defaultCarport({ type: "hip", depthFt: 30 }));
    expect(l.members.filter((m) => m.part === "hip")).toHaveLength(4);
    expect(l.roofPlanes).toHaveLength(4);
    expect(l.ridge).not.toBeNull();
    // eave half extents 11 x 16 -> ridge half-length 5; commons where |z| <= 5
    const commons = l.members.filter((m) => m.part === "rafter");
    for (const m of commons) expect(Math.abs(m.a[2])).toBeLessThanOrEqual(5 + 1e-9);
    expect(l.members.filter((m) => m.part === "jack").length).toBeGreaterThan(0);
    // peak = eave underside + pitch x short half-extent, plus the framing lift
    const lift = (7.25 / 12 + 0.75 / 12) * Math.sqrt(1 + (4 / 12) ** 2);
    expect(l.heights.peakFt).toBeCloseTo(l.heights.eaveUndersideFt + 11 * (4 / 12) + lift);
  });

  it("hip on a square footprint is a pyramid with no ridge", () => {
    const l = layoutCarport(defaultCarport({ type: "hip", depthFt: 20 }));
    expect(l.ridge).toBeNull();
    expect(l.roofPlanes).toHaveLength(4);
  });
});

describe("layoutCarport: braces", () => {
  it("braces the four corner posts along the beam", () => {
    const l = layoutCarport(defaultCarport());
    const braces = l.members.filter((m) => m.part === "brace");
    expect(braces).toHaveLength(4);
    for (const b of braces) {
      expect(b.a[0]).toBeCloseTo(b.b[0]); // in the plane of the row
      expect(b.b[1] - b.a[1]).toBeCloseTo(Math.abs(b.b[2] - b.a[2])); // 45 degrees
      expect(b.b[1]).toBeCloseTo(8); // meets the beam underside
    }
  });
});

describe("buildCarport", () => {
  it("is deterministic and produces one mesh per part", () => {
    const c = defaultCarport();
    const l = layoutCarport(c);
    const g1 = buildCarport(c);
    const g2 = buildCarport(c);
    const expected = l.posts.length + l.beams.length + (l.ridge ? 1 : 0) + l.members.length + l.roofPlanes.length;
    expect(g1.children).toHaveLength(expected);
    expect(g1.children.every((o) => o instanceof Mesh)).toBe(true);
    expect(g1.children.map((o) => o.position.toArray())).toEqual(g2.children.map((o) => o.position.toArray()));
  });

  it("every part casts and receives shadows", () => {
    for (const o of buildCarport(defaultCarport({ type: "hip" })).children) {
      expect(o.castShadow).toBe(true);
      expect(o.receiveShadow).toBe(true);
    }
  });
});
