/** Pure calibration math. All points are in the shared aerial pixel frame. */
import type { AerialTile, Point } from "@/schema/project";

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function pxDistance(p1: Point, p2: Point): number {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
}

export function pxPerFootFrom(p1: Point, p2: Point, knownFeet: number): number {
  return pxDistance(p1, p2) / knownFeet;
}

export function feetBetween(p1: Point, p2: Point, pxPerFoot: number): number {
  return pxDistance(p1, p2) / pxPerFoot;
}

/** The offset a new tile needs so that `pointInNewTile` lands on `pointInFrame`. */
export function tileOffsetFromMatch(pointInFrame: Point, pointInNewTile: Point): Point {
  return [pointInFrame[0] - pointInNewTile[0], pointInFrame[1] - pointInNewTile[1]];
}

export function compositeBounds(tiles: readonly AerialTile[]): Bounds | null {
  if (tiles.length === 0) return null;
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const t of tiles) {
    b.minX = Math.min(b.minX, t.offsetPx[0]);
    b.minY = Math.min(b.minY, t.offsetPx[1]);
    b.maxX = Math.max(b.maxX, t.offsetPx[0] + t.widthPx);
    b.maxY = Math.max(b.maxY, t.offsetPx[1] + t.heightPx);
  }
  return b;
}

/** Signed percent difference of a measured value against what the user says it is. */
export function deltaPercent(measured: number, stated: number): number {
  return ((measured - stated) / stated) * 100;
}

export function formatFeet(feet: number): string {
  const whole = Math.floor(feet);
  const inches = Math.round((feet - whole) * 12);
  if (inches === 12) return `${whole + 1}' 0"`;
  return `${whole}' ${inches}"`;
}
