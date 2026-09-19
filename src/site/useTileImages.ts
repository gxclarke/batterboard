import { useEffect, useState } from "react";
import type { AerialTile } from "@/schema/project";
import { getBlob } from "@/store/persistence";
import { loadImage } from "./images";

export interface TileImage {
  tile: AerialTile;
  image: HTMLImageElement;
}

const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadTileImage(blobKey: string): Promise<HTMLImageElement> {
  let p = cache.get(blobKey);
  if (!p) {
    p = getBlob(blobKey).then((blob) => {
      if (!blob) throw new Error(`Missing image ${blobKey}`);
      return loadImage(blob);
    });
    p.catch(() => cache.delete(blobKey));
    cache.set(blobKey, p);
  }
  return p;
}

/** Decoded images for the project's tiles, in tile order. Missing blobs are skipped. */
export function useTileImages(tiles: readonly AerialTile[]): TileImage[] {
  const [images, setImages] = useState<TileImage[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      tiles.map((tile) =>
        loadTileImage(tile.blobKey).then(
          (image) => ({ tile, image }) as TileImage,
          () => null,
        ),
      ),
    ).then((loaded) => {
      if (!cancelled) setImages(loaded.filter((x): x is TileImage => x !== null));
    });
    return () => {
      cancelled = true;
    };
  }, [tiles]);
  return images;
}
