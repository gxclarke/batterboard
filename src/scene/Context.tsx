/** Existing-site geometry: massing blocks, ground surfaces, lot boundary. */
import { useEffect, useMemo } from "react";
import type { Object3D } from "three";
import { buildLotBoundary } from "@/geometry/lot";
import { buildMass } from "@/geometry/mass";
import { disposeObject } from "@/geometry/structures";
import { buildSurface } from "@/geometry/surface";
import { useProject } from "@/store/useProject";

function useBuilt<T>(items: readonly T[], build: (item: T, index: number) => Object3D): Object3D[] {
  const objects = useMemo(() => items.map(build), [items, build]);
  useEffect(
    () => () => {
      for (const o of objects) disposeObject(o);
    },
    [objects],
  );
  return objects;
}

export function Context() {
  const masses = useProject((s) => s.project.masses);
  const surfaces = useProject((s) => s.project.surfaces);
  const lot = useProject((s) => s.project.site.lot.boundary);
  const massObjects = useBuilt(masses, buildMass);
  const surfaceObjects = useBuilt(surfaces, buildSurface);
  const lotObject = useMemo(() => (lot ? buildLotBoundary(lot) : null), [lot]);
  useEffect(() => () => void (lotObject && disposeObject(lotObject)), [lotObject]);
  return (
    <>
      {massObjects.map((o) => (
        <primitive key={o.name} object={o} />
      ))}
      {surfaceObjects.map((o) => (
        <primitive key={o.name} object={o} />
      ))}
      {lotObject && <primitive object={lotObject} />}
    </>
  );
}
