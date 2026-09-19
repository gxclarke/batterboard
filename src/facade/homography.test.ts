import { describe, expect, it } from "vitest";
import type { Point } from "@/schema/project";
import { applyHomography, isUsableQuad, squareToQuad } from "./homography";

describe("homography", () => {
  const quad: [Point, Point, Point, Point] = [
    [100, 80],
    [420, 120],
    [400, 360],
    [90, 300],
  ];
  it("maps the unit square corners onto the quad", () => {
    const H = squareToQuad(quad);
    const near = (p: Point, q: Point) => expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeLessThan(1e-6);
    near(applyHomography(H, 0, 0), quad[0]);
    near(applyHomography(H, 1, 0), quad[1]);
    near(applyHomography(H, 1, 1), quad[2]);
    near(applyHomography(H, 0, 1), quad[3]);
  });
  it("is affine for a parallelogram", () => {
    const H = squareToQuad([
      [0, 0],
      [200, 0],
      [200, 100],
      [0, 100],
    ]);
    expect(H.g).toBe(0);
    expect(H.h).toBe(0);
    expect(applyHomography(H, 0.5, 0.5)).toEqual([100, 50]);
  });
  it("keeps straight lines straight (midpoint of an edge maps onto that edge)", () => {
    const H = squareToQuad(quad);
    const [mx, my] = applyHomography(H, 0.5, 0);
    const [ax, ay] = quad[0];
    const [bx, by] = quad[1];
    const cross = (bx - ax) * (my - ay) - (by - ay) * (mx - ax);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
  });
  it("rejects twisted or degenerate quads", () => {
    expect(isUsableQuad(quad)).toBe(true);
    expect(
      isUsableQuad([
        [0, 0],
        [10, 10],
        [10, 0],
        [0, 10],
      ]),
    ).toBe(false);
    expect(
      isUsableQuad([
        [0, 0],
        [10, 0],
        [20, 0],
        [0, 10],
      ]),
    ).toBe(false);
  });
});
