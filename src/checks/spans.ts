/**
 * Span tables for the reality checks. These are approximations of common
 * prescriptive tables for #2 softwood at light roof loads, chosen to be
 * plausible rather than authoritative. They power amber advisories, never
 * hard blocks, and never a claim of code compliance. See docs/adr/0009.
 *
 * Rafter spans: horizontal projection, ~IRC R802.4.1 for DF-L #2, 20 psf
 * live / 10 psf dead. Beam spans: IRC R507.5 deck girder table (50 psf) with
 * a 1.25 factor for a 30 psf roof, interpolated on tributary width.
 */
import type { Carport } from "@/schema/project";

type RafterSize = Carport["framing"]["rafterSize"];
type BeamSize = Carport["framing"]["beamSize"];

const RAFTER_FT: Record<RafterSize, { 16: number; 24: number }> = {
  "2x6": { 16: 13.4, 24: 11.0 },
  "2x8": { 16: 17.0, 24: 13.9 },
  "2x10": { 16: 20.75, 24: 17.0 },
  "2x12": { 16: 24.1, 24: 19.7 },
};

export function maxRafterSpanFt(size: RafterSize, spacingIn: 16 | 24): number {
  return RAFTER_FT[size][spacingIn];
}

/** Deck girder spans (ft) by tributary width column, for 2-ply and 3-ply built-up beams. */
const TRIB_COLS = [6, 8, 10, 12, 14, 16, 18] as const;
const DECK_BEAM: Record<string, number[]> = {
  "2x8:2": [8.75, 7.6, 6.75, 6.15, 5.75, 5.35, 5.0],
  "2x8:3": [10.9, 9.5, 8.5, 7.75, 7.15, 6.7, 6.3],
  "2x10:2": [10.35, 9.0, 8.0, 7.35, 6.75, 6.35, 6.0],
  "2x10:3": [13.0, 11.25, 10.0, 9.15, 8.5, 7.9, 7.5],
  "2x12:2": [12.15, 10.6, 9.4, 8.6, 8.0, 7.5, 7.0],
  "2x12:3": [15.25, 13.25, 11.85, 10.75, 10.0, 9.35, 8.85],
};
const ROOF_FACTOR = 1.25;

function interpolate(cols: number[], tributaryFt: number): number {
  if (tributaryFt <= TRIB_COLS[0]) return cols[0] as number;
  const last = TRIB_COLS[TRIB_COLS.length - 1] as number;
  if (tributaryFt >= last) return (cols[cols.length - 1] as number) * (last / tributaryFt);
  for (let i = 1; i < TRIB_COLS.length; i++) {
    const hi = TRIB_COLS[i] as number;
    if (tributaryFt <= hi) {
      const lo = TRIB_COLS[i - 1] as number;
      const t = (tributaryFt - lo) / (hi - lo);
      return (cols[i - 1] as number) * (1 - t) + (cols[i] as number) * t;
    }
  }
  return cols[cols.length - 1] as number;
}

/**
 * Longest recommended clear span between posts for a beam carrying
 * `tributaryFt` of roof. Solid 4x and 6x and LVL are scaled from the built-up
 * rows by section width, which is coarse but directionally right.
 */
export function maxBeamSpanFt(size: BeamSize, ply: number, tributaryFt: number): number {
  const p = Math.min(3, Math.max(1, ply));
  let base: number;
  switch (size) {
    case "2x8":
    case "2x10":
    case "2x12": {
      const row = DECK_BEAM[`${size}:${Math.max(2, p)}`] as number[];
      base = interpolate(row, tributaryFt);
      if (p === 1) base *= 0.55; // a single 2x is not a carport beam
      break;
    }
    case "4x10":
      base = interpolate(DECK_BEAM["2x10:2"] as number[], tributaryFt) * 1.1 * (p > 1 ? 1.4 : 1);
      break;
    case "6x10":
      base = interpolate(DECK_BEAM["2x10:2"] as number[], tributaryFt) * 1.6 * (p > 1 ? 1.3 : 1);
      break;
    case "lvl":
      base = interpolate(DECK_BEAM["2x12:2"] as number[], tributaryFt) * (p === 1 ? 1.3 : p === 2 ? 2.0 : 2.5);
      break;
  }
  return base * ROOF_FACTOR;
}
