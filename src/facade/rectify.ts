/**
 * Warp the quad a user marked in a photo into an upright rectangle. Browser only.
 * Runs once per facade and is cached by the caller.
 */
import type { Point } from "@/schema/project";
import { applyHomography, squareToQuad } from "./homography";

const MAX_OUT_W = 1024;
const MAX_SRC = 2048;

export function rectifyToCanvas(
  img: HTMLImageElement,
  corners: readonly [Point, Point, Point, Point],
  aspect: number, // wall length / wall height
): HTMLCanvasElement {
  // source, downscaled for memory; corners scale with it
  const k = Math.min(1, MAX_SRC / Math.max(img.naturalWidth, img.naturalHeight));
  const sw = Math.max(1, Math.round(img.naturalWidth * k));
  const sh = Math.max(1, Math.round(img.naturalHeight * k));
  const src = document.createElement("canvas");
  src.width = sw;
  src.height = sh;
  const sctx = src.getContext("2d");
  if (!sctx) throw new Error("No 2D context");
  sctx.drawImage(img, 0, 0, sw, sh);
  const sdata = sctx.getImageData(0, 0, sw, sh).data;

  const H = squareToQuad(corners.map(([x, y]) => [x * k, y * k] as Point) as [Point, Point, Point, Point]);

  const outW = MAX_OUT_W;
  const outH = Math.max(16, Math.min(2048, Math.round(outW / Math.max(0.2, aspect))));
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("No 2D context");
  const odata = octx.createImageData(outW, outH);
  const o = odata.data;

  for (let py = 0; py < outH; py++) {
    const t = (py + 0.5) / outH;
    for (let px = 0; px < outW; px++) {
      const s = (px + 0.5) / outW;
      const [sx, sy] = applyHomography(H, s, t);
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const oi = (py * outW + px) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) {
        o[oi] = 128;
        o[oi + 1] = 128;
        o[oi + 2] = 128;
        o[oi + 3] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = (sdata[i00 + c] as number) * (1 - fx) + (sdata[i10 + c] as number) * fx;
        const bot = (sdata[i01 + c] as number) * (1 - fx) + (sdata[i11 + c] as number) * fx;
        o[oi + c] = top * (1 - fy) + bot * fy;
      }
      o[oi + 3] = 255;
    }
  }
  octx.putImageData(odata, 0, 0);
  return out;
}
