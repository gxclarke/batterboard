/**
 * Sun direction for the site. Pure. suncalc 2 gives altitude and azimuth in
 * degrees, azimuth clockwise from north. We turn that into a site-frame vector
 * using the image's north offset (ADR 0004).
 */
import * as SunCalc from "suncalc";
import type { Vec3 } from "@/schema/project";

export interface SunInput {
  lat: number;
  lon: number;
  /** clockwise bearing of image-up from true north */
  northOffsetDeg: number;
  date: Date;
}

export interface SunState {
  altitudeDeg: number;
  /** compass bearing of the sun, clockwise from north */
  bearingDeg: number;
  /** unit vector pointing from the site toward the sun, Three.js coordinates */
  dir: Vec3;
  up: boolean;
}

const RAD = Math.PI / 180;

/** Site-frame unit vector toward a compass bearing, given the image's north offset. */
export function bearingToDir(bearingDeg: number, northOffsetDeg: number, altitudeDeg = 0): Vec3 {
  const phi = (bearingDeg - northOffsetDeg) * RAD; // clockwise from image-up
  const c = Math.cos(altitudeDeg * RAD);
  // image-up is site -y (Three -z); clockwise rotation on screen swings toward +x
  return [Math.sin(phi) * c, Math.sin(altitudeDeg * RAD), -Math.cos(phi) * c];
}

export function sunState({ lat, lon, northOffsetDeg, date }: SunInput): SunState {
  const pos = SunCalc.getPosition(date, lat, lon);
  const altitudeDeg = pos.altitude;
  const bearingDeg = ((pos.azimuth % 360) + 360) % 360;
  return { altitudeDeg, bearingDeg, dir: bearingToDir(bearingDeg, northOffsetDeg, altitudeDeg), up: altitudeDeg > 0 };
}

/** A local Date for month/day/hour in the current year. Hour is decimal. */
export function dateFor(month: number, day: number, hour: number, year = new Date().getFullYear()): Date {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return new Date(year, month - 1, day, h, m, 0, 0);
}

export function formatHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
