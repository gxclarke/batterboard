/** Pure 2D polygon math. Points are [x, y] in whatever unit the caller uses. */
import type { Point } from "@/schema/project";

export function signedArea(poly: readonly Point[]): number {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i] as Point;
    const q = poly[(i + 1) % n] as Point;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export const area = (poly: readonly Point[]): number => Math.abs(signedArea(poly));

export function centroid(poly: readonly Point[]): Point {
  const a = signedArea(poly);
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i] as Point;
    const q = poly[(i + 1) % n] as Point;
    const f = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * f;
    cy += (p[1] + q[1]) * f;
  }
  return [cx / (6 * a), cy / (6 * a)];
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function orient(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a[0], b[0]) - 1e-9 <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) + 1e-9 &&
    Math.min(a[1], b[1]) - 1e-9 <= p[1] &&
    p[1] <= Math.max(a[1], b[1]) + 1e-9
  );
}

/** Proper or touching intersection of segments ab and cd. */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 * o2 < 0 && o3 * o4 < 0) return true;
  if (Math.abs(o1) < 1e-9 && onSegment(a, b, c)) return true;
  if (Math.abs(o2) < 1e-9 && onSegment(a, b, d)) return true;
  if (Math.abs(o3) < 1e-9 && onSegment(c, d, a)) return true;
  if (Math.abs(o4) < 1e-9 && onSegment(c, d, b)) return true;
  return false;
}

/**
 * Would appending `next` to the open chain `pts` create a crossing?
 * The new segment is checked against every earlier segment except the one it
 * shares a vertex with.
 */
export function chainWouldCross(pts: readonly Point[], next: Point): boolean {
  const n = pts.length;
  if (n < 2) return false;
  const last = pts[n - 1] as Point;
  for (let i = 0; i + 1 < n - 1; i++) {
    if (segmentsIntersect(pts[i] as Point, pts[i + 1] as Point, last, next)) return true;
  }
  return false;
}

/** A closed polygon with no self-intersections and non-trivial area. */
export function isSimplePolygon(poly: readonly Point[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  if (area(poly) < 1e-6) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i] as Point;
    const b = poly[(i + 1) % n] as Point;
    for (let j = i + 1; j < n; j++) {
      // skip adjacent edges (they share a vertex)
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const c = poly[j] as Point;
      const d = poly[(j + 1) % n] as Point;
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Point;
    const b = poly[j] as Point;
    const cross = a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];
    if (cross) inside = !inside;
  }
  return inside;
}

/** Rectangle from an edge a→b and a third point giving the depth on one side. */
export function rectFromEdgeAndPoint(a: Point, b: Point, c: Point): [Point, Point, Point, Point] {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const len = Math.hypot(ex, ey) || 1;
  const nx = -ey / len;
  const ny = ex / len;
  const depth = (c[0] - a[0]) * nx + (c[1] - a[1]) * ny; // signed distance from line ab
  return [a, b, [b[0] + nx * depth, b[1] + ny * depth], [a[0] + nx * depth, a[1] + ny * depth]];
}

/** Four corners of a rectangle centered at c, rotated by `deg` (site convention: clockwise on screen). */
export function rectCorners(c: Point, deg: number, width: number, depth: number): [Point, Point, Point, Point] {
  const r = (deg * Math.PI) / 180;
  const ux = Math.cos(r);
  const uy = Math.sin(r);
  const vx = -uy;
  const vy = ux;
  const hw = width / 2;
  const hd = depth / 2;
  const P = (a: number, b: number): Point => [c[0] + ux * a + vx * b, c[1] + uy * a + vy * b];
  return [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)];
}

export interface RectFrame {
  /** center */
  c: Point;
  /** unit vector along the chosen axis */
  u: Point;
  /** unit vector perpendicular to u (u rotated +90° in site space) */
  v: Point;
  /** half extents along u and v */
  hu: number;
  hv: number;
}

/**
 * If `poly` is a rectangle (4 corners, right angles within tolerance), return
 * its frame with `u` along whichever edge direction is closest to `axisDeg`.
 */
export function rectFrame(poly: readonly Point[], axisDeg: number): RectFrame | null {
  if (poly.length !== 4) return null;
  const [p0, p1, p2, p3] = poly as [Point, Point, Point, Point];
  const e0: Point = [p1[0] - p0[0], p1[1] - p0[1]];
  const e1: Point = [p2[0] - p1[0], p2[1] - p1[1]];
  const l0 = Math.hypot(e0[0], e0[1]);
  const l1 = Math.hypot(e1[0], e1[1]);
  if (l0 < 1e-6 || l1 < 1e-6) return null;
  const cosAngle = (e0[0] * e1[0] + e0[1] * e1[1]) / (l0 * l1);
  if (Math.abs(cosAngle) > 0.08) return null; // more than ~5° off square
  // opposite edges must match
  const e2: Point = [p3[0] - p2[0], p3[1] - p2[1]];
  if (Math.abs(Math.hypot(e2[0], e2[1]) - l0) > 0.05 * l0 + 0.2) return null;

  const r = (axisDeg * Math.PI) / 180;
  const ax = Math.cos(r);
  const ay = Math.sin(r);
  const d0 = Math.abs((e0[0] * ax + e0[1] * ay) / l0);
  const d1 = Math.abs((e1[0] * ax + e1[1] * ay) / l1);
  const along = d0 >= d1 ? e0 : e1;
  const alongLen = d0 >= d1 ? l0 : l1;
  const u: Point = [along[0] / alongLen, along[1] / alongLen];
  const v: Point = [-u[1], u[0]];
  return {
    c: [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2],
    u,
    v,
    hu: (d0 >= d1 ? l0 : l1) / 2,
    hv: (d0 >= d1 ? l1 : l0) / 2,
  };
}

/** Bearing (site degrees) of the longest edge of a polygon. */
export function longestEdgeDeg(poly: readonly Point[]): number {
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as Point;
    const b = poly[(i + 1) % poly.length] as Point;
    const len = distance(a, b);
    if (len > bestLen) {
      bestLen = len;
      best = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    }
  }
  return ((best % 360) + 360) % 360;
}

/**
 * Move corner `index` of a rectangle to `target`, sliding its two neighbors so
 * the shape stays a rectangle. Non-rectangles get a plain vertex move.
 */
export function moveCornerKeepingRect(poly: readonly Point[], index: number, target: Point): Point[] {
  const f = poly.length === 4 ? rectFrame(poly, 0) : null;
  if (!f) return poly.map((p, i) => (i === index ? target : p));
  const local = (p: Point): Point => [
    (p[0] - f.c[0]) * f.u[0] + (p[1] - f.c[1]) * f.u[1],
    (p[0] - f.c[0]) * f.v[0] + (p[1] - f.c[1]) * f.v[1],
  ];
  const world = ([a, b]: Point): Point => [f.c[0] + f.u[0] * a + f.v[0] * b, f.c[1] + f.u[1] * a + f.v[1] * b];
  const L = poly.map(local);
  const me = L[index] as Point;
  const t = local(target);
  const prev = (index + 3) % 4;
  const next = (index + 1) % 4;
  const out = L.map((p) => [p[0], p[1]] as Point);
  out[index] = t;
  for (const n of [prev, next]) {
    const q = out[n] as Point;
    // the neighbor that shared my `a` coordinate follows my new `a`; likewise for `b`
    if (Math.abs(q[0] - me[0]) < Math.abs(q[1] - me[1])) out[n] = [t[0], q[1]];
    else out[n] = [q[0], t[1]];
  }
  return out.map(world);
}

/** Do two simple polygons overlap (edges cross or one contains a corner of the other)? */
export function polygonsIntersect(a: readonly Point[], b: readonly Point[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i] as Point;
    const a2 = a[(i + 1) % a.length] as Point;
    for (let j = 0; j < b.length; j++) {
      if (segmentsIntersect(a1, a2, b[j] as Point, b[(j + 1) % b.length] as Point)) return true;
    }
  }
  return pointInPolygon(a[0] as Point, b) || pointInPolygon(b[0] as Point, a);
}

export function distancePointToSegment(p: Point, a: Point, b: Point): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
}

/** Shortest distance from a point to the outline of a polygon. */
export function distanceToOutline(p: Point, poly: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, distancePointToSegment(p, poly[i] as Point, poly[(i + 1) % poly.length] as Point));
  }
  return best;
}

/** Shortest distance between two polygon outlines (0 when they overlap). */
export function polygonGap(a: readonly Point[], b: readonly Point[]): number {
  if (polygonsIntersect(a, b)) return 0;
  let best = Infinity;
  for (const p of a) best = Math.min(best, distanceToOutline(p, b));
  for (const p of b) best = Math.min(best, distanceToOutline(p, a));
  return best;
}

export function scalePolygon(poly: readonly Point[], k: number): Point[] {
  return poly.map(([x, y]) => [x * k, y * k]);
}

export function bounds(poly: readonly Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [x, y] of poly) {
    b.minX = Math.min(b.minX, x);
    b.minY = Math.min(b.minY, y);
    b.maxX = Math.max(b.maxX, x);
    b.maxY = Math.max(b.maxY, y);
  }
  return b;
}
