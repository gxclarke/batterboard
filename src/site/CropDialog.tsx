import { useEffect, useRef, useState } from "react";
import { type CropRect, cropToBlob, loadImage } from "./images";

interface Props {
  file: File;
  onCancel: () => void;
  onDone: (result: { blob: Blob; width: number; height: number }) => void;
}

const MIN_CROP_PX = 32;

/** Drag a rectangle to cut phone chrome and map labels off a screenshot. */
export function CropDialog({ file, onCancel, onDone }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [sel, setSel] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fit = useRef({ scale: 1, ox: 0, oy: 0 });
  const dragStart = useRef<[number, number] | null>(null);

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

  // layout + paint
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas || !img) return;
    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const ox = (w - dw) / 2;
      const oy = (h - dh) / 2;
      fit.current = { scale, ox, oy };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, ox, oy, dw, dh);
      if (sel) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, w, h);
        const sx = ox + sel.x * scale;
        const sy = oy + sel.y * scale;
        const sw = sel.w * scale;
        const sh = sel.h * scale;
        ctx.drawImage(img, sel.x, sel.y, sel.w, sel.h, sx, sy, sw, sh);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
      }
    };
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [img, sel]);

  const toImage = (e: React.PointerEvent): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { scale, ox, oy } = fit.current;
    const x = (e.clientX - rect.left - ox) / scale;
    const y = (e.clientY - rect.top - oy) / scale;
    return [Math.max(0, Math.min(img?.naturalWidth ?? 0, x)), Math.max(0, Math.min(img?.naturalHeight ?? 0, y))];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = toImage(e);
    setSel(null);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = dragStart.current;
    if (!s) return;
    const [x, y] = toImage(e);
    setSel({ x: Math.min(s[0], x), y: Math.min(s[1], y), w: Math.abs(x - s[0]), h: Math.abs(y - s[1]) });
  };
  const onUp = () => {
    dragStart.current = null;
    setSel((r) => (r && r.w >= MIN_CROP_PX && r.h >= MIN_CROP_PX ? r : null));
  };

  const finish = async (rect: CropRect) => {
    if (!img) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(img, rect);
      onDone({ blob, width: Math.round(rect.w), height: Math.round(rect.h) });
    } catch {
      setError("Could not process the image.");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <header>
          <h2>Crop the screenshot</h2>
          <p className="muted">
            Drag to keep just the map. Cut off the status bar, search box and labels if you can. Screenshots should be
            north-up at the same zoom as any others you add.
          </p>
        </header>
        <div className="crop-stage" ref={stageRef}>
          {error && <p className="warn">{error}</p>}
          <canvas
            ref={canvasRef}
            style={{ cursor: "crosshair", touchAction: "none" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>
        <footer className="row">
          <button type="button" className="primary" disabled={!sel || busy} onClick={() => sel && finish(sel)}>
            Use selection
          </button>
          <button
            type="button"
            disabled={!img || busy}
            onClick={() => img && finish({ x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight })}
          >
            Use full image
          </button>
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
