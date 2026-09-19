/** Mass -> THREE.Group: one quad per wall (so walls can carry facade photos), a cap, and a roof. Pure. */
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  type Texture,
} from "three";
import type { Mass, Point, Vec3 } from "@/schema/project";
import { pointInPolygon } from "@/trace/polygon";
import { siteToThreeTuple } from "./frame";
import { layoutRoof, type RoofPlane } from "./roof";

const ROOF_COLOR = "#4f4b46";

/** A THREE.Shape whose extrusion, after rotation.x = -PI/2, lands on site coordinates. */
export function siteShape(poly: readonly Point[]): Shape {
  const shape = new Shape();
  poly.forEach(([x, y], i) => {
    if (i === 0) shape.moveTo(x, -y);
    else shape.lineTo(x, -y);
  });
  shape.closePath();
  return shape;
}

export function planeGeometry(plane: RoofPlane): BufferGeometry {
  const v = plane.vertices;
  const tris: number[] = [];
  const first = v[0] as Vec3;
  for (let i = 1; i + 1 < v.length; i++) tris.push(...first, ...(v[i] as Vec3), ...(v[i + 1] as Vec3));
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(tris, 3));
  g.computeVertexNormals();
  return g;
}

export interface WallFrame {
  /** left end of the wall as seen from outside, site feet */
  left: Point;
  right: Point;
  /** unit outward normal, site feet */
  outward: Point;
  lengthFt: number;
}

/**
 * Wall `i` runs from footprint[i] to footprint[i+1]. Returns its ends ordered
 * left-to-right for a viewer standing outside, regardless of trace direction.
 */
export function wallFrame(footprint: readonly Point[], i: number): WallFrame | null {
  const n = footprint.length;
  if (n < 3 || i < 0 || i >= n) return null;
  const a = footprint[i] as Point;
  const b = footprint[(i + 1) % n] as Point;
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const len = Math.hypot(ex, ey);
  if (len < 1e-9) return null;
  let nx = ey / len;
  let ny = -ex / len;
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (pointInPolygon([mid[0] + nx * 0.01, mid[1] + ny * 0.01], footprint)) {
    nx = -nx;
    ny = -ny;
  }
  // viewer outside looks along -n (three: x = site x, z = site y); their right vector is (n_z, -n_x)
  const rx = ny;
  const ry = -nx;
  const aDot = a[0] * rx + a[1] * ry;
  const bDot = b[0] * rx + b[1] * ry;
  const [left, right] = aDot <= bDot ? [a, b] : [b, a];
  return { left, right, outward: [nx, ny], lengthFt: len };
}

function wallQuad(frame: WallFrame, base: number, top: number): BufferGeometry {
  const lb = siteToThreeTuple(frame.left, base);
  const rb = siteToThreeTuple(frame.right, base);
  const rt = siteToThreeTuple(frame.right, top);
  const lt = siteToThreeTuple(frame.left, top);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute([...lb, ...rb, ...rt, ...lb, ...rt, ...lt], 3));
  g.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
}

/** `textures` maps wall index to a rectified facade texture. */
export function buildMass(mass: Mass, textures?: Map<number, Texture>): Group {
  const group = new Group();
  group.name = mass.id;
  const wallMat = new MeshStandardMaterial({ color: mass.color, roughness: 0.9, side: DoubleSide });
  const roofMat = new MeshStandardMaterial({ color: ROOF_COLOR, roughness: 0.95, side: DoubleSide });
  const base = mass.baseElevation;
  const top = base + mass.wallHeight;

  for (let i = 0; i < mass.footprint.length; i++) {
    const frame = wallFrame(mass.footprint, i);
    if (!frame) continue;
    const tex = textures?.get(i);
    const mat = tex ? new MeshStandardMaterial({ map: tex, roughness: 0.9, side: DoubleSide }) : wallMat;
    const wall = new Mesh(wallQuad(frame, base, top), mat);
    wall.name = `wall-${i}`;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  const cap = new Mesh(new ShapeGeometry(siteShape(mass.footprint)), wallMat);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = top;
  cap.name = "cap";
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  const roof = layoutRoof(mass.footprint, base, mass.wallHeight, mass.roof);
  for (const p of roof.planes) {
    const m = new Mesh(planeGeometry(p), roofMat);
    m.name = "roof";
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  for (const w of roof.walls) {
    const m = new Mesh(planeGeometry(w), wallMat);
    m.name = "gable";
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  return group;
}
