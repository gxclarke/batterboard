import { DoubleSide, MeshStandardMaterial } from "three";
import type { Carport } from "@/schema/project";

export function woodMaterial(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
}

export function roofingMaterial(roofing: Carport["roofing"], color: string): MeshStandardMaterial {
  switch (roofing) {
    case "standing-seam":
      return new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25, side: DoubleSide });
    case "corrugated-metal":
      return new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3, side: DoubleSide });
    case "asphalt-shingle":
      return new MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, side: DoubleSide });
    case "polycarbonate":
      return new MeshStandardMaterial({
        color,
        roughness: 0.1,
        metalness: 0,
        transparent: true,
        opacity: 0.45,
        side: DoubleSide,
      });
  }
}
