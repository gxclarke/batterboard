/** Mass -> THREE.Group: extruded walls plus a roof. Pure. */
import {
  BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
} from "three";
import type { Mass, Point, Vec3 } from "@/schema/project";
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

export function buildMass(mass: Mass): Group {
  const group = new Group();
  group.name = mass.id;
  const wallMat = new MeshStandardMaterial({ color: mass.color, roughness: 0.9, side: 2 });
  const roofMat = new MeshStandardMaterial({ color: ROOF_COLOR, roughness: 0.95, side: 2 });

  const walls = new Mesh(
    new ExtrudeGeometry(siteShape(mass.footprint), { depth: mass.wallHeight, bevelEnabled: false }),
    wallMat,
  );
  walls.rotation.x = -Math.PI / 2;
  walls.position.y = mass.baseElevation;
  walls.name = "walls";
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  const roof = layoutRoof(mass.footprint, mass.baseElevation, mass.wallHeight, mass.roof);
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
