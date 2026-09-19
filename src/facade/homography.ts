/**
 * Square-to-quad projective mapping (Heckbert). Pure.
 * (s, t) in the unit square maps to the quad p0..p3 with
 * (0,0)->p0 (top-left), (1,0)->p1 (top-right), (1,1)->p2 (bottom-right), (0,1)->p3 (bottom-left).
 */
import type { Point } from "@/schema/project";

export interface Homography {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
}

export function squareToQuad([p0, p1, p2, p3]: readonly [Point, Point, Point, Point]): Homography {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    return { a: x1 - x0, b: x3 - x0, c: x0, d: y1 - y0, e: y3 - y0, f: y0, g: 0, h: 0 };
  }
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return {
    a: x1 - x0 + g * x1,
    b: x3 - x0 + h * x3,
    c: x0,
    d: y1 - y0 + g * y1,
    e: y3 - y0 + h * y3,
    f: y0,
    g,
    h,
  };
}

export function applyHomography(H: Homography, s: number, t: number): Point {
  const w = H.g * s + H.h * t + 1;
  return [(H.a * s + H.b * t + H.c) / w, (H.d * s + H.e * t + H.f) / w];
}

/** A quad is usable when it is convex and has area (the four clicks were in order). */
export function isUsableQuad(q: readonly Point[]): boolean {
  if (q.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i] as Point;
    const b = q[(i + 1) % 4] as Point;
    const c = q[(i + 2) % 4] as Point;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
