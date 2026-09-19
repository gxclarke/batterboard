import { useEffect, useMemo } from "react";
import { buildStructure, disposeObject } from "@/geometry/structures";
import { useProject } from "@/store/useProject";

/** Renders every structure in the project through its deterministic generator. */
export function Structures() {
  const structures = useProject((s) => s.project.structures);
  const groups = useMemo(() => structures.map(buildStructure), [structures]);
  useEffect(() => {
    return () => {
      for (const g of groups) disposeObject(g);
    };
  }, [groups]);
  return groups.map((g) => <primitive key={g.name} object={g} />);
}
