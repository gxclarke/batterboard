/**
 * Roof surfaces for a massing block. Pure. Works on a rectangular footprint;
 * other footprints fall back to flat with a note the UI can show.
 * Output is in Three.js coordinates via the frame helper.
 */
import type { Mass, Point, Vec3 } from "@/schema/project";
import { rectFrame } from "@/trace/polygon";
import { siteToThreeTuple } from "./frame";

export interface RoofPlane {
  vertices: Vec3[];
}

export interface RoofLayout {
  /** sloped or flat roof surfaces, roof color */
  planes: RoofPlane[];
  /** vertical infill above the wall top (gable ends, shed high wall), wall color */
  walls: RoofPlane[];
  peakFt: number;
  note: string | null;
}

const NOT_RECT = "Gable, hip and shed roofs need a rectangular block. This block is drawn with a flat roof.";

export function layoutRoof(
  footprint: readonly Point[],
  baseElevation: number,
  wallHeight: number,
  roof: Mass["roof"],
): RoofLayout {
  const top = baseElevation + wallHeight;
  if (roof.type === "flat") return flat(footprint, top);
  const f = rectFrame(footprint, roof.ridgeAxisDeg);
  if (!f) return { ...flat(footprint, top), note: NOT_RECT };

  const k = roof.pitch / 12;
  const ov = roof.overhangFt;
  const P = (a: number, b: number, h: number): Vec3 =>
    siteToThreeTuple([f.c[0] + f.u[0] * a + f.v[0] * b, f.c[1] + f.u[1] * a + f.v[1] * b], h);

  if (roof.type === "gable") {
    const A = f.hu + ov; // along ridge, includes rake overhang
    const B = f.hv + ov; // across, includes eave overhang
    const he = top - k * ov;
    const hr = top + k * f.hv;
    return {
      planes: [
        { vertices: [P(-A, B, he), P(A, B, he), P(A, 0, hr), P(-A, 0, hr)] },
        { vertices: [P(A, -B, he), P(-A, -B, he), P(-A, 0, hr), P(A, 0, hr)] },
      ],
      walls: [
        { vertices: [P(f.hu, -f.hv, top), P(f.hu, f.hv, top), P(f.hu, 0, hr)] },
        { vertices: [P(-f.hu, f.hv, top), P(-f.hu, -f.hv, top), P(-f.hu, 0, hr)] },
      ],
      peakFt: hr,
      note: null,
    };
  }

  if (roof.type === "shed") {
    // slopes down toward +u (ridgeAxisDeg is the downslope direction)
    const B = f.hv + ov;
    const hLow = top - k * ov; // at a = +(hu + ov)
    const hHigh = hLow + k * 2 * (f.hu + ov); // at a = -(hu + ov)
    const hHighWall = top + k * 2 * f.hu;
    return {
      planes: [
        {
          vertices: [
            P(-(f.hu + ov), -B, hHigh),
            P(-(f.hu + ov), B, hHigh),
            P(f.hu + ov, B, hLow),
            P(f.hu + ov, -B, hLow),
          ],
        },
      ],
      walls: [
        { vertices: [P(-f.hu, -f.hv, top), P(f.hu, -f.hv, top), P(-f.hu, -f.hv, hHighWall)] },
        { vertices: [P(f.hu, f.hv, top), P(-f.hu, f.hv, top), P(-f.hu, f.hv, hHighWall)] },
        {
          vertices: [P(-f.hu, f.hv, top), P(-f.hu, -f.hv, top), P(-f.hu, -f.hv, hHighWall), P(-f.hu, f.hv, hHighWall)],
        },
      ],
      peakFt: hHighWall,
      note: null,
    };
  }

  // hip: equal pitch all round. Work in (long, short) half extents.
  const A = f.hu + ov;
  const B = f.hv + ov;
  const he = top - k * ov;
  const longIsU = A >= B;
  const L = longIsU ? A : B;
  const S = longIsU ? B : A;
  const hp = he + k * S;
  const r = L - S; // ridge half-length
  const Q = (l: number, s: number, h: number) => (longIsU ? P(l, s, h) : P(s, l, h));
  return {
    planes: [
      { vertices: [Q(-L, S, he), Q(L, S, he), Q(r, 0, hp), Q(-r, 0, hp)] },
      { vertices: [Q(L, -S, he), Q(-L, -S, he), Q(-r, 0, hp), Q(r, 0, hp)] },
      { vertices: [Q(L, S, he), Q(L, -S, he), Q(r, 0, hp)] },
      { vertices: [Q(-L, -S, he), Q(-L, S, he), Q(-r, 0, hp)] },
    ],
    walls: [],
    peakFt: hp,
    note: null,
  };
}

function flat(footprint: readonly Point[], top: number): RoofLayout {
  return {
    planes: [{ vertices: footprint.map((p) => siteToThreeTuple(p, top + 0.05)) }],
    walls: [],
    peakFt: top,
    note: null,
  };
}
