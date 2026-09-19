/**
 * The one place site space becomes Three.js space.
 *
 * Site: 2D feet, +x right, +y down (image orientation), angles clockwise from +x.
 * Three: y up, right-handed. Viewed from above, +x is screen-right and +z is
 * screen-down, so site (x, y) -> three (x, elevation, y) with no mirroring.
 * A clockwise site angle is a negative rotation about three's +y.
 */
import { Vector3 } from "three";
import type { Point, Vec3 } from "@/schema/project";

export const DEG2RAD = Math.PI / 180;

export function siteToThree([x, y]: Point, elevationFt = 0): Vector3 {
  return new Vector3(x, elevationFt, y);
}

/** Same mapping as siteToThree, as a plain tuple for layout code. */
export function siteToThreeTuple([x, y]: Point, elevationFt = 0): Vec3 {
  return [x, elevationFt, y];
}

export function threeToSite(v: Vector3): Point {
  return [v.x, v.z];
}

export function siteAngleToRotationY(deg: number): number {
  return -deg * DEG2RAD;
}
