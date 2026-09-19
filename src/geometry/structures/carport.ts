/**
 * Carport -> Three.js. THE core generator.
 *
 * Two layers, both pure:
 *   layoutCarport(carport) -> CarportLayout   plain numbers, unit-testable
 *   buildCarport(carport)  -> THREE.Group     meshes from the layout
 *
 * Local frame (before site placement): x across the width, z along the depth
 * (the direction vehicles enter), y up, origin at footprint center on grade.
 * Framing convention is documented in docs/adr/0003 and on CarportSchema.
 */
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import type { Carport, Vec3 } from "@/schema/project";
import { inToFt, lumber } from "../lumber";
import { roofingMaterial, woodMaterial } from "../materials";

export type Part = "post" | "beam" | "ridge" | "rafter" | "jack" | "hip" | "brace" | "tie" | "king" | "strut";

/** Axis-aligned box. */
export interface Box {
  part: Part;
  center: Vec3;
  size: Vec3;
}

/** A sloped member defined by the centerline of its underside, from a to b. */
export interface Member {
  part: Part;
  a: Vec3;
  b: Vec3;
  thicknessFt: number;
  depthFt: number;
}

export interface RoofPlane {
  /** 3 or 4 vertices of the finished roof surface (top of sheathing). */
  vertices: Vec3[];
}

export interface CarportLayout {
  posts: Box[];
  beams: Box[];
  ridge: Box | null;
  members: Member[];
  roofPlanes: RoofPlane[];
  /** Faces of the graded pad under the posts when the ground slopes (empty when flat). */
  pad: Vec3[][];
  /** Ground height under local (x, z); 0 at the lowest corner. */
  groundAt: (x: number, z: number) => number;
  /** Rafter stations along the ridge axis, in local feet. */
  rafterStationsFt: number[];
  heights: {
    /** underside of rafters at the outer post row (low side for shed) */
    bearingFt: number;
    /** top of the framing at its highest point */
    peakFt: number;
    eaveUndersideFt: number;
  };
}

const SHEATHING_FT = inToFt(0.75);
const BRACE_LEG_FT = 2.5;
const BRACE = lumber("4x4");
const RIDGE_BOARD = lumber("2x12");
const MIN_MEMBER_FT = inToFt(2);
const TIE = lumber("6x8");
const TRUSS_WEB = lumber("6x6");

/** n values evenly spaced from `from` to `to`, inclusive. n >= 2. */
export function spread(from: number, to: number, n: number): number[] {
  if (n < 2) return [from];
  const step = (to - from) / (n - 1);
  return Array.from({ length: n }, (_, i) => from + i * step);
}

/** Layout stations every `step` from `from`, always ending with one at `to`. */
export function stations(from: number, to: number, step: number): number[] {
  const n = Math.floor((to - from) / step + 1e-9);
  const out = Array.from({ length: n + 1 }, (_, i) => from + i * step);
  const last = out[out.length - 1] ?? from;
  if (to - last > inToFt(1)) out.push(to);
  return out;
}

export function layoutCarport(c: Carport): CarportLayout {
  const w = c.widthFt;
  const d = c.depthFt;
  const k = c.roofPitch / 12;
  const slopeFactor = Math.sqrt(1 + k * k);

  const post = lumber(c.posts.size);
  const a = post.depthFt; // posts are square
  const beam = lumber(c.framing.beamSize);
  const beamThick = beam.thicknessFt * c.framing.beamPly;
  const beamDepth = beam.depthFt;
  const rafter = lumber(c.framing.rafterSize);
  const spacing = inToFt(c.framing.rafterSpacingIn);

  const eave = c.overhangFt.eave;
  const rake = c.type === "hip" ? eave : c.overhangFt.rake;

  // Outer post-row centerline. plateHeightFt is measured at this row.
  const xBear = w / 2 - a / 2;
  const bearingFt = c.plateHeightFt + beamDepth; // rafter underside at the outer row

  /** Rafter underside height at local x, for the prismatic roof types. */
  const undersideAt = (x: number): number => {
    switch (c.type) {
      case "gable":
      case "hip":
        return bearingFt + k * (xBear - Math.abs(x));
      case "shed":
        return bearingFt + k * (xBear - x);
    }
  };
  const plateAt = (x: number): number => undersideAt(x) - beamDepth;

  // 0. ground: a plane that rises from the lowest corner of the footprint
  const groundAt = makeGround(c, w, d);

  // 1. posts, from the ground up to the beam bearing
  const rowXs = spread(-xBear, xBear, c.posts.countAlongWidth);
  const postZs = spread(-(d / 2 - a / 2), d / 2 - a / 2, c.posts.countAlongDepth);
  const posts: Box[] = [];
  for (const x of rowXs) {
    const top = plateAt(x);
    for (const z of postZs) {
      const base = groundAt(x, z);
      posts.push({ part: "post", center: [x, (top + base) / 2, z], size: [a, top - base, a] });
    }
  }

  // 2. beams, one per row, running along depth, ends flush with post faces
  const beams: Box[] = rowXs.map((x) => ({
    part: "beam",
    center: [x, plateAt(x) + beamDepth / 2, 0],
    size: [beamThick, beamDepth, d],
  }));

  // 3-5. rafters and roof planes
  const members: Member[] = [];
  const roofPlanes: RoofPlane[] = [];
  let ridge: Box | null = null;
  let rafterStationsFt: number[] = [];
  const liftFt = (rafter.depthFt + SHEATHING_FT) * slopeFactor; // vertical offset underside -> roof surface

  const xEave = w / 2 + eave;
  const zEnd = d / 2 + rake;
  const rafterOf = (part: Part, p: Vec3, q: Vec3): Member => ({
    part,
    a: p,
    b: q,
    thicknessFt: rafter.thicknessFt,
    depthFt: rafter.depthFt,
  });

  let peakFt: number;
  let eaveUndersideFt: number;

  if (c.type === "gable") {
    const yRidge = undersideAt(0);
    const yEave = undersideAt(xEave);
    peakFt = yRidge + liftFt;
    eaveUndersideFt = yEave;
    rafterStationsFt = stations(-zEnd, zEnd, spacing);
    for (const z of rafterStationsFt) {
      members.push(rafterOf("rafter", [0, yRidge, z], [xEave, yEave, z]));
      members.push(rafterOf("rafter", [0, yRidge, z], [-xEave, yEave, z]));
    }
    ridge = {
      part: "ridge",
      center: [0, yRidge + rafter.depthFt * slopeFactor - RIDGE_BOARD.depthFt / 2, 0],
      size: [RIDGE_BOARD.thicknessFt, RIDGE_BOARD.depthFt, 2 * zEnd],
    };
    const yr = yRidge + liftFt;
    const ye = yEave + liftFt;
    roofPlanes.push({
      vertices: [
        [0, yr, -zEnd],
        [0, yr, zEnd],
        [xEave, ye, zEnd],
        [xEave, ye, -zEnd],
      ],
    });
    roofPlanes.push({
      vertices: [
        [0, yr, zEnd],
        [0, yr, -zEnd],
        [-xEave, ye, -zEnd],
        [-xEave, ye, zEnd],
      ],
    });
  } else if (c.type === "shed") {
    const yHigh = undersideAt(-xEave);
    const yLow = undersideAt(xEave);
    peakFt = yHigh + liftFt;
    eaveUndersideFt = yLow;
    rafterStationsFt = stations(-zEnd, zEnd, spacing);
    for (const z of rafterStationsFt) {
      members.push(rafterOf("rafter", [-xEave, yHigh, z], [xEave, yLow, z]));
    }
    roofPlanes.push({
      vertices: [
        [-xEave, yHigh + liftFt, -zEnd],
        [-xEave, yHigh + liftFt, zEnd],
        [xEave, yLow + liftFt, zEnd],
        [xEave, yLow + liftFt, -zEnd],
      ],
    });
  } else {
    // hip: equal pitch on all four faces, eave all around at `eave`.
    // Work in (u, v) where u is the long plan axis, then map to (x, z).
    const hx = xEave;
    const hz = d / 2 + eave;
    const longIsZ = hz >= hx;
    const hu = longIsZ ? hz : hx;
    const hv = longIsZ ? hx : hz;
    const ye = undersideAt(xEave);
    const yP = ye + k * hv; // peak underside
    const ru = hu - hv; // ridge half-length along u
    peakFt = yP + liftFt;
    eaveUndersideFt = ye;
    const P = (u: number, y: number, v: number): Vec3 => (longIsZ ? [v, y, u] : [u, y, v]);

    // commons and side-face jacks at stations along u
    rafterStationsFt = stations(-hu, hu, spacing);
    for (const u of rafterStationsFt) {
      const run = Math.min(hv, hu - Math.abs(u)); // horizontal run from eave toward ridge/hip
      if (run < MIN_MEMBER_FT) continue;
      const part: Part = run < hv - 1e-9 ? "jack" : "rafter";
      const yTop = ye + k * run;
      members.push(rafterOf(part, P(u, ye, hv), P(u, yTop, hv - run)));
      members.push(rafterOf(part, P(u, ye, -hv), P(u, yTop, -(hv - run))));
    }
    // end-face jacks (and the king common at v = 0) at stations along v
    for (const v of stations(-hv, hv, spacing)) {
      const run = hv - Math.abs(v);
      if (run < MIN_MEMBER_FT) continue;
      const yTop = ye + k * run;
      members.push(rafterOf("jack", P(hu, ye, v), P(hu - run, yTop, v)));
      members.push(rafterOf("jack", P(-hu, ye, v), P(-(hu - run), yTop, v)));
    }
    // four hip rafters, corner to ridge end
    for (const su of [-1, 1]) {
      for (const sv of [-1, 1]) {
        members.push(rafterOf("hip", P(su * hu, ye, sv * hv), P(su * ru, yP, 0)));
      }
    }
    if (ru > MIN_MEMBER_FT) {
      const size: Vec3 = longIsZ
        ? [RIDGE_BOARD.thicknessFt, RIDGE_BOARD.depthFt, 2 * ru]
        : [2 * ru, RIDGE_BOARD.depthFt, RIDGE_BOARD.thicknessFt];
      ridge = { part: "ridge", center: [0, yP + rafter.depthFt * slopeFactor - RIDGE_BOARD.depthFt / 2, 0], size };
    }
    const yr = yP + liftFt;
    const yee = ye + liftFt;
    // two long faces (trapezoids; triangles when ru = 0) and two end faces (triangles)
    roofPlanes.push({ vertices: [P(-hu, yee, hv), P(hu, yee, hv), P(ru, yr, 0), P(-ru, yr, 0)] });
    roofPlanes.push({ vertices: [P(hu, yee, -hv), P(-hu, yee, -hv), P(-ru, yr, 0), P(ru, yr, 0)] });
    roofPlanes.push({ vertices: [P(hu, yee, hv), P(hu, yee, -hv), P(ru, yr, 0)] });
    roofPlanes.push({ vertices: [P(-hu, yee, -hv), P(-hu, yee, hv), P(-ru, yr, 0)] });
  }

  // 5b. king-post truss in each gable end
  if (c.type === "gable" && c.gableTruss) {
    const tieTop = bearingFt; // flush with the beam tops
    const yRidge = undersideAt(0);
    const zEnds = [postZs[0] ?? 0, postZs[postZs.length - 1] ?? 0];
    for (const z of zEnds) {
      members.push({
        part: "tie",
        a: [-xBear, tieTop - TIE.depthFt, z],
        b: [xBear, tieTop - TIE.depthFt, z],
        thicknessFt: TIE.thicknessFt,
        depthFt: TIE.depthFt,
      });
      members.push({
        part: "king",
        a: [0, tieTop, z],
        b: [0, yRidge, z],
        thicknessFt: TRUSS_WEB.thicknessFt,
        depthFt: TRUSS_WEB.depthFt,
      });
      const kneeY = tieTop + (yRidge - tieTop) * 0.3;
      for (const s of [-1, 1]) {
        const xEnd = s * xBear * 0.62;
        members.push({
          part: "strut",
          a: [0, kneeY, z],
          b: [xEnd, undersideAt(xEnd), z],
          thicknessFt: TRUSS_WEB.thicknessFt,
          depthFt: TRUSS_WEB.depthFt,
        });
      }
    }
  }

  // 6. knee braces on the corner posts, in the plane of the beam
  const firstZ = postZs[0] ?? 0;
  const lastZ = postZs[postZs.length - 1] ?? 0;
  const outerRows = [rowXs[0] ?? 0, rowXs[rowXs.length - 1] ?? 0];
  const leg = Math.min(BRACE_LEG_FT, (lastZ - firstZ) / 2 - a);
  if (leg > MIN_MEMBER_FT) {
    for (const x of outerRows) {
      const top = plateAt(x);
      for (const [z, s] of [
        [firstZ, 1],
        [lastZ, -1],
      ] as const) {
        members.push({
          part: "brace",
          a: [x, top - leg, z + s * (a / 2)],
          b: [x, top, z + s * (a / 2 + leg)],
          thicknessFt: BRACE.thicknessFt,
          depthFt: BRACE.depthFt,
        });
      }
    }
  }

  // 7. graded pad: a wedge from the aerial plane up to the sloped ground
  const pad: Vec3[][] = [];
  if (c.ground.dropFt > 0) {
    const m = a; // a little apron past the post faces
    const cx = [-(w / 2 + m), w / 2 + m, w / 2 + m, -(w / 2 + m)];
    const cz = [-(d / 2 + m), -(d / 2 + m), d / 2 + m, d / 2 + m];
    const top = cx.map((x, i): Vec3 => [x, groundAt(x, cz[i] as number), cz[i] as number]);
    const bottom = cx.map((x, i): Vec3 => [x, 0, cz[i] as number]);
    pad.push(top);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      pad.push([bottom[i] as Vec3, bottom[j] as Vec3, top[j] as Vec3, top[i] as Vec3]);
    }
  }

  return {
    posts,
    beams,
    ridge,
    members,
    roofPlanes,
    pad,
    groundAt,
    rafterStationsFt,
    heights: { bearingFt, peakFt, eaveUndersideFt },
  };
}

/**
 * Ground height under the footprint: 0 at the lowest corner, rising to
 * `dropFt` at the highest, along the downhill direction in the local frame.
 */
function makeGround(c: Carport, w: number, d: number): (x: number, z: number) => number {
  const drop = c.ground.dropFt;
  if (drop <= 0) return () => 0;
  const phi = ((c.ground.towardDeg - c.rotationDeg) * Math.PI) / 180;
  const ux = Math.cos(phi);
  const uz = Math.sin(phi);
  const corners: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  const projections = corners.map(([x, z]) => x * ux + z * uz);
  const lo = Math.min(...projections);
  const hi = Math.max(...projections);
  const span = hi - lo || 1;
  // larger projection = further downhill = lower ground
  return (x, z) => ((hi - (x * ux + z * uz)) / span) * drop;
}

// ---------- meshes ----------

function boxMesh(box: Box, material: Mesh["material"]): Mesh {
  const mesh = new Mesh(new BoxGeometry(...box.size), material);
  mesh.position.set(...box.center);
  mesh.name = box.part;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const Y_UP = new Vector3(0, 1, 0);

function memberMesh(m: Member, material: Mesh["material"]): Mesh {
  const A = new Vector3(...m.a);
  const B = new Vector3(...m.b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  dir.normalize();
  // "up" is the direction perpendicular to the member within its vertical plane
  const up = Y_UP.clone().sub(dir.clone().multiplyScalar(Y_UP.dot(dir)));
  if (up.lengthSq() < 1e-9) up.set(1, 0, 0);
  up.normalize();
  const side = new Vector3().crossVectors(dir, up).normalize();

  const mesh = new Mesh(new BoxGeometry(len, m.depthFt, m.thicknessFt), material);
  mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(dir, up, side));
  mesh.position
    .copy(A)
    .add(B)
    .multiplyScalar(0.5)
    .add(up.multiplyScalar(m.depthFt / 2));
  mesh.name = m.part;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function planeMesh(plane: RoofPlane, material: Mesh["material"]): Mesh {
  const v = plane.vertices;
  const tris: number[] = [];
  const first = v[0] as Vec3;
  for (let i = 1; i + 1 < v.length; i++) {
    tris.push(...first, ...(v[i] as Vec3), ...(v[i + 1] as Vec3));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(tris, 3));
  geometry.computeVertexNormals();
  const mesh = new Mesh(geometry, material);
  mesh.name = "roof";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Pure: same Carport in, identical Group out. No store access, no side effects. */
export function buildCarport(c: Carport): Group {
  const layout = layoutCarport(c);
  const group = new Group();
  group.name = c.id;

  const postMat = woodMaterial(c.colors.post);
  const trimMat = woodMaterial(c.colors.trim);
  const roofMat = roofingMaterial(c.roofing, c.colors.roof);

  for (const p of layout.posts) group.add(boxMesh(p, postMat));
  for (const b of layout.beams) group.add(boxMesh(b, postMat));
  if (layout.ridge) group.add(boxMesh(layout.ridge, trimMat));
  const heavy = new Set<Part>(["brace", "tie", "king", "strut"]);
  for (const m of layout.members) group.add(memberMesh(m, heavy.has(m.part) ? postMat : trimMat));
  for (const r of layout.roofPlanes) group.add(planeMesh(r, roofMat));
  if (layout.pad.length > 0) {
    const padMat = new MeshStandardMaterial({ color: "#c2bcae", roughness: 1, side: DoubleSide });
    for (const face of layout.pad) {
      const mesh = planeMesh({ vertices: face }, padMat);
      mesh.name = "pad";
      mesh.castShadow = false;
      group.add(mesh);
    }
  }

  return group;
}
