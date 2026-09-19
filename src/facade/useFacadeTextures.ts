import { useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import { wallFrame } from "@/geometry/mass";
import type { Mass } from "@/schema/project";
import { loadTileImage } from "@/site/useTileImages";
import { rectifyToCanvas } from "./rectify";

/** wallIndex -> texture, per mass id */
export type FacadeTextures = Map<string, Map<number, Texture>>;

const cache = new Map<string, Promise<Texture>>();

function textureFor(mass: Mass, f: NonNullable<Mass["facade"]>[number], anisotropy: number): Promise<Texture> {
  const frame = wallFrame(mass.footprint, f.wallIndex);
  const key = `${f.blobKey}|${f.corners.flat().join(",")}|${frame?.lengthFt.toFixed(2)}|${mass.wallHeight}`;
  let p = cache.get(key);
  if (!p) {
    p = loadTileImage(f.blobKey).then((img) => {
      const aspect = frame ? frame.lengthFt / mass.wallHeight : 1;
      const t = new CanvasTexture(rectifyToCanvas(img, f.corners, aspect));
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = anisotropy;
      return t;
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

export function useFacadeTextures(masses: readonly Mass[]): FacadeTextures {
  const gl = useThree((s) => s.gl);
  const [textures, setTextures] = useState<FacadeTextures>(new Map());
  const signature = masses
    .map(
      (m) =>
        `${m.id}:${m.wallHeight}:${(m.facade ?? []).map((f) => `${f.wallIndex}=${f.blobKey}@${f.corners.flat().join(",")}`).join(";")}`,
    )
    .join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` summarizes every facade input
  useEffect(() => {
    let cancelled = false;
    const anisotropy = gl.capabilities.getMaxAnisotropy();
    const jobs = masses.flatMap((m) =>
      (m.facade ?? []).map((f) =>
        textureFor(m, f, anisotropy).then(
          (t) => ({ massId: m.id, wallIndex: f.wallIndex, t }),
          () => null,
        ),
      ),
    );
    if (jobs.length === 0) {
      setTextures(new Map());
      return;
    }
    Promise.all(jobs).then((list) => {
      if (cancelled) return;
      const next: FacadeTextures = new Map();
      for (const item of list) {
        if (!item) continue;
        const byWall = next.get(item.massId) ?? new Map<number, Texture>();
        byWall.set(item.wallIndex, item.t);
        next.set(item.massId, byWall);
      }
      setTextures(next);
    });
    return () => {
      cancelled = true;
    };
  }, [signature, gl]);
  return textures;
}
