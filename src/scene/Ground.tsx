import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

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

/**
 * Ground plane with a 1 ft / 10 ft grid baked into its texture. Receives
 * shadows. The aerial image replaces this once a site is calibrated.
 */
export function Ground() {
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
