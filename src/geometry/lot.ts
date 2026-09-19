import { BufferGeometry, LineDashedMaterial, LineLoop, Vector3 } from "three";
import type { Point } from "@/schema/project";
import { siteToThree } from "./frame";

export function buildLotBoundary(points: readonly Point[]): LineLoop {
  const geometry = new BufferGeometry().setFromPoints(points.map((p) => siteToThree(p, 0.08)));
  const line = new LineLoop(geometry, new LineDashedMaterial({ color: "#e11d48", dashSize: 2, gapSize: 1 }));
  line.computeLineDistances();
  line.name = "lot";
  return line;
}

export { Vector3 };
