/**
 * Nominal lumber sizes to actual dimensions. A 2x8 is 1.5" x 7.25"; a 6x6 is
 * 5.5" square. Using the real numbers is most of what separates "looks like a
 * structure" from "looks like a toy."
 */

const ACTUAL_IN: Record<string, number> = {
  "1": 0.75,
  "2": 1.5,
  "3": 2.5,
  "4": 3.5,
  "6": 5.5,
  "8": 7.25,
  "10": 9.25,
  "12": 11.25,
};

export interface LumberDims {
  /** the smaller dimension, inches */
  thicknessIn: number;
  /** the larger dimension, inches */
  depthIn: number;
  thicknessFt: number;
  depthFt: number;
}

export const inToFt = (inches: number): number => inches / 12;
export const ftToIn = (feet: number): number => feet * 12;

function dims(thicknessIn: number, depthIn: number): LumberDims {
  return { thicknessIn, depthIn, thicknessFt: inToFt(thicknessIn), depthFt: inToFt(depthIn) };
}

/** `"2x8"`, `"6x6"`, or `"lvl"` (a typical 1.75" x 11.875" ply). */
export function lumber(nominal: string): LumberDims {
  if (nominal === "lvl") return dims(1.75, 11.875);
  const m = /^(\d+)x(\d+)$/.exec(nominal);
  if (!m) throw new Error(`Unknown lumber size "${nominal}"`);
  const a = ACTUAL_IN[m[1] as string];
  const b = ACTUAL_IN[m[2] as string];
  if (a === undefined || b === undefined) throw new Error(`Unknown lumber size "${nominal}"`);
  return dims(Math.min(a, b), Math.max(a, b));
}
