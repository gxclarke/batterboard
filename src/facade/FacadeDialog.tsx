import { useEffect, useMemo, useState } from "react";
import type { Bounds } from "@/calibrate/scale";
import { drawHandle } from "@/calibrate/useLinePick";
import type { AerialTile, Point } from "@/schema/project";
import { loadImage } from "@/site/images";
import { type OverlayFn, SiteCanvas } from "@/site/SiteCanvas";
import type { TileImage } from "@/site/useTileImages";
import { isUsableQuad } from "./homography";

interface Props {
  file: File;
  wallLabel: string;
  onCancel: () => void;
  onDone: (corners: [Point, Point, Point, Point]) => void;
}

const LABELS = ["top-left", "top-right", "bottom-right", "bottom-left"];
const COLOR = "#38bdf8";

/** Click the four corners of a wall in a photo, in order. */
export function FacadeDialog({ file, wallLabel, onCancel, onDone }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [pts, setPts] = useState<Point[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadImage(file).then(
      (i) => !cancelled && setImg(i),
      () => !cancelled && setError("That file could not be read as an image."),
    );
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace") setPts((p) => p.slice(0, -1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const images = useMemo<TileImage[]>(() => {
    if (!img) return [];
    const tile: AerialTile = {
      id: "photo",
      name: "photo",
      blobKey: "photo",
      widthPx: img.naturalWidth,
      heightPx: img.naturalHeight,
      offsetPx: [0, 0],
    };
    return [{ tile, image: img }];
  }, [img]);
  const bounds = useMemo<Bounds | null>(
    () => (img ? { minX: 0, minY: 0, maxX: img.naturalWidth, maxY: img.naturalHeight } : null),
    [img],
  );

  const overlay = useMemo<OverlayFn>(
    () => (ctx, view) => {
      if (pts.length >= 2) {
        ctx.save();
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        if (pts.length === 4) ctx.closePath();
        ctx.lineWidth = 2 / view.scale;
        ctx.strokeStyle = COLOR;
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.font = `${13 / view.scale}px system-ui, sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3 / view.scale;
      pts.forEach((p, i) => {
        drawHandle(ctx, view, p, COLOR);
        ctx.strokeText(String(i + 1), p[0] + 10 / view.scale, p[1] - 10 / view.scale);
        ctx.fillText(String(i + 1), p[0] + 10 / view.scale, p[1] - 10 / view.scale);
      });
      ctx.restore();
    },
    [pts],
  );

  const usable = pts.length === 4 && isUsableQuad(pts);

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide">
        <header>
          <h2>Photo for {wallLabel}</h2>
          <p className="muted">
            Click the wall's four corners in order: top-left, top-right, bottom-right, bottom-left, as you see the wall
            in the photo. Where a corner is hidden by a bush or the roof, click where it would be. Backspace removes the
            last point.
          </p>
        </header>
        <div className="crop-stage">
          {error && <p className="warn">{error}</p>}
          {img && (
            <SiteCanvas
              images={images}
              bounds={bounds}
              overlay={overlay}
              onClick={(p) => setPts((prev) => (prev.length < 4 ? [...prev, p] : prev))}
              loupe
              cursor="crosshair"
            />
          )}
        </div>
        <footer className="row">
          <span className="muted">
            {pts.length < 4
              ? `Next: ${LABELS[pts.length]}`
              : usable
                ? "Ready"
                : "Those corners cross. Backspace and try again."}
          </span>
          <span className="spacer" />
          <button
            type="button"
            className="primary"
            disabled={!usable}
            onClick={() => usable && onDone(pts as [Point, Point, Point, Point])}
          >
            Apply to wall
          </button>
          <button type="button" onClick={() => setPts([])} disabled={pts.length === 0}>
            Start over
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
