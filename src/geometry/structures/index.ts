/**
 * Structure registry: one deterministic generator per structure kind.
 * Adding a kind means adding a schema member and a case here.
 */
import type { Group, Object3D } from "three";
import type { Structure } from "@/schema/project";
import { siteAngleToRotationY, siteToThree } from "../frame";
import { buildCarport } from "./carport";

function buildLocal(s: Structure): Group {
  switch (s.kind) {
    case "carport":
      return buildCarport(s);
  }
}

/** Build a structure and place it in site space (Three.js coordinates). */
export function buildStructure(s: Structure): Group {
  const group = buildLocal(s);
  group.position.copy(siteToThree(s.position));
  group.rotation.y = siteAngleToRotationY(s.rotationDeg);
  return group;
}

/** Free GPU resources owned by a built structure. Materials are per-build too. */
export function disposeObject(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
    mesh.geometry?.dispose();
    if (Array.isArray(mesh.material)) for (const m of mesh.material) m.dispose();
    else mesh.material?.dispose();
  });
}
