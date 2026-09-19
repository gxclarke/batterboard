import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, Texture } from "three";
import { siteToThree } from "@/geometry/frame";
import type { AerialTile } from "@/schema/project";
import { loadTileImage } from "@/site/useTileImages";
import { useProject } from "@/store/useProject";

const GROUND_FT = 600;
const SECTION_FT = 10;
const TILE_PX = 512;

/** One 10 ft x 10 ft tile: faint 1 ft cells, a darker section line on the border. */
function drawGridTile(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#c9cfbf";
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  const cell = TILE_PX / SECTION_FT;
  ctx.strokeStyle = "#aeb5a8";
  ctx.lineWidth = 2;
  for (let i = 1; i < SECTION_FT; i++) {
    const p = Math.round(i * cell) + 0.5;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, TILE_PX);
    ctx.moveTo(0, p);
    ctx.lineTo(TILE_PX, p);
    ctx.stroke();
  }
  ctx.strokeStyle = "#7d877e";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, TILE_PX, TILE_PX);
  return canvas;
}

/** Ground: the calibrated aerial when there is one, otherwise a 1 ft / 10 ft grid. */
export function Ground() {
  const tiles = useProject((s) => s.project.site.tiles);
  const scale = useProject((s) => s.project.site.scale);
  if (scale && tiles.length > 0) return <AerialGround tiles={tiles} pxPerFoot={scale.pxPerFoot} />;
  return <GridGround />;
}

function GridGround() {
  const gl = useThree((s) => s.gl);
  const texture = useMemo(() => {
    const t = new CanvasTexture(drawGridTile());
    t.wrapS = RepeatWrapping;
    t.wrapT = RepeatWrapping;
    t.repeat.set(GROUND_FT / SECTION_FT, GROUND_FT / SECTION_FT);
    t.anisotropy = gl.capabilities.getMaxAnisotropy();
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[GROUND_FT, GROUND_FT]} />
      <meshStandardMaterial map={texture} roughness={1} />
    </mesh>
  );
}

interface TileTexture {
  tile: AerialTile;
  texture: Texture;
}

function useTileTextures(tiles: readonly AerialTile[]): TileTexture[] {
  const gl = useThree((s) => s.gl);
  const [textures, setTextures] = useState<TileTexture[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      tiles.map((tile) =>
        loadTileImage(tile.blobKey).then(
          (img) => {
            const texture = new Texture(img);
            texture.colorSpace = SRGBColorSpace;
            texture.anisotropy = gl.capabilities.getMaxAnisotropy();
            texture.needsUpdate = true;
            return { tile, texture } as TileTexture;
          },
          () => null,
        ),
      ),
    ).then((list) => {
      const loaded = list.filter((x): x is TileTexture => x !== null);
      if (cancelled) for (const t of loaded) t.texture.dispose();
      else setTextures(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [tiles, gl]);
  useEffect(
    () => () => {
      for (const t of textures) t.texture.dispose();
    },
    [textures],
  );
  return textures;
}

function AerialGround({ tiles, pxPerFoot }: { tiles: readonly AerialTile[]; pxPerFoot: number }) {
  const textures = useTileTextures(tiles);
  return (
    <>
      {/* neutral ground under and beyond the imagery */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[GROUND_FT * 2, GROUND_FT * 2]} />
        <meshStandardMaterial color="#b8b3a4" roughness={1} />
      </mesh>
      {textures.map(({ tile, texture }, i) => {
        const w = tile.widthPx / pxPerFoot;
        const h = tile.heightPx / pxPerFoot;
        const center = siteToThree([
          (tile.offsetPx[0] + tile.widthPx / 2) / pxPerFoot,
          (tile.offsetPx[1] + tile.heightPx / 2) / pxPerFoot,
        ]);
        // later tiles sit a hair higher so overlaps don't z-fight
        center.y = i * 0.002;
        return (
          <mesh key={tile.id} position={center} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[w, h]} />
            <meshStandardMaterial map={texture} roughness={1} />
          </mesh>
        );
      })}
    </>
  );
}
