/** Surface -> flat colored polygon on the ground. Pure. */
import { Mesh, MeshStandardMaterial, ShapeGeometry } from "three";
import type { Surface } from "@/schema/project";
import { siteShape } from "./mass";

export const SURFACE_COLORS: Record<Surface["material"], string> = {
  concrete: "#d6d2c6",
  asphalt: "#4a4a4a",
  gravel: "#b8ad98",
  grass: "#7c9a5a",
  pavers: "#a98a6c",
};

export function buildSurface(surface: Surface, index = 0): Mesh {
  const mesh = new Mesh(
    new ShapeGeometry(siteShape(surface.polygon)),
    new MeshStandardMaterial({
      color: SURFACE_COLORS[surface.material],
      roughness: 1,
      transparent: true,
      opacity: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01 + index * 0.002;
  mesh.receiveShadow = true;
  mesh.name = surface.id;
  return mesh;
}
