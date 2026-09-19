/**
 * Pan-and-zoom 2D canvas over the aerial tiles. Tools draw through `overlay`
 * and receive clicks in shared pixel-frame coordinates. Drag pans, wheel and
 * pinch zoom, a plain click reaches the tool. With `loupe`, a magnifier
 * follows the cursor so users can hit corners precisely.
 */
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef } from "react";
import type { Bounds } from "@/calibrate/scale";
import type { Point } from "@/schema/project";
import type { TileImage } from "./useTileImages";

export interface CanvasView {
  scale: number;
  tx: number;
  ty: number;
}
export type OverlayFn = (ctx: CanvasRenderingContext2D, view: CanvasView) => void;

interface Props {
  images: TileImage[];
  bounds: Bounds | null;
  overlay?: OverlayFn;
  onClick?: (p: Point) => void;
  onMove?: (p: Point | null) => void;
  loupe?: boolean;
  cursor?: string;
}

const MIN_SCALE = 0.02;
const MAX_SCALE = 40;
const CLICK_SLOP_PX = 4;
const LOUPE_R = 64;
const LOUPE_ZOOM = 3;
const BG = "#e6e6e0";

export function SiteCanvas({ images, bounds, overlay, onClick, onMove, loupe = false, cursor = "grab" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<CanvasView>({ scale: 1, tx: 0, ty: 0 });
  const pointer = useRef<Point | null>(null);
  const raf = useRef(0);
  const latest = useRef({ images, overlay, loupe, onClick, onMove });
  latest.current = { images, overlay, loupe, onClick, onMove };

  const toFrame = useCallback((sx: number, sy: number): Point => {
    const v = view.current;
    return [(sx - v.tx) / v.scale, (sy - v.ty) / v.scale];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { images, overlay, loupe } = latest.current;
    const v = view.current;

    const paint = (vw: CanvasView) => {
      ctx.setTransform(dpr * vw.scale, 0, 0, dpr * vw.scale, dpr * vw.tx, dpr * vw.ty);
      ctx.imageSmoothingEnabled = vw.scale < 1;
      for (const { tile, image } of images) {
        ctx.drawImage(image, tile.offsetPx[0], tile.offsetPx[1], tile.widthPx, tile.heightPx);
      }
      overlay?.(ctx, vw);
    };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    paint(v);

    if (loupe && pointer.current) {
      const cx = LOUPE_R + 12;
      const cy = LOUPE_R + 12;
      const [px, py] = pointer.current;
      const s = v.scale * LOUPE_ZOOM;
      const lv: CanvasView = { scale: s, tx: cx - px * s, ty: cy - py * s };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, LOUPE_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, cx + LOUPE_R, cy + LOUPE_R);
      paint(lv);
      ctx.restore();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#1e1e1c";
      ctx.beginPath();
      ctx.arc(cx, cy, LOUPE_R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,60,60,0.9)";
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy);
      ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 10);
      ctx.stroke();
    }
  }, []);

  const requestDraw = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(draw);
  }, [draw]);

  const fitView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bounds) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    if (w <= 0 || h <= 0 || bw <= 0 || bh <= 0) return;
    const pad = 24;
    const scale = Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh);
    view.current = {
      scale,
      tx: (w - bw * scale) / 2 - bounds.minX * scale,
      ty: (h - bh * scale) / 2 - bounds.minY * scale,
    };
    requestDraw();
  }, [bounds, requestDraw]);

  const zoomAt = useCallback(
    (sx: number, sy: number, factor: number) => {
      const v = view.current;
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const k = ns / v.scale;
      view.current = { scale: ns, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k };
      requestDraw();
    },
    [requestDraw],
  );

  // size the backing store to the element
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      requestDraw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [requestDraw]);

  // fit once per distinct bounds
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = bounds ? `${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}` : null;
    if (key && fittedFor.current !== key) {
      fittedFor.current = key;
      fitView();
    }
  }, [bounds, fitView]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw whenever the inputs change; they are read through `latest`
  useEffect(() => {
    requestDraw();
  }, [images, overlay, loupe, requestDraw]);

  // wheel zoom must be non-passive to prevent page scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // pointer handling: drag pans, two pointers pinch, a still click reaches the tool
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ sx: number; sy: number; tx0: number; ty0: number; moved: boolean } | null>(null);
  const pinchDist = useRef<number | null>(null);

  const local = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      drag.current = { sx: p.x, sy: p.y, tx0: view.current.tx, ty0: view.current.ty, moved: false };
    } else {
      drag.current = null;
      const [a, b] = Array.from(pointers.current.values());
      if (a && b) pinchDist.current = Math.hypot(b.x - a.x, b.y - a.y);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const p = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);

    if (pointers.current.size === 2 && pinchDist.current) {
      const [a, b] = Array.from(pointers.current.values());
      if (a && b) {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist.current);
        pinchDist.current = d;
      }
      return;
    }

    const d = drag.current;
    if (d) {
      const dx = p.x - d.sx;
      const dy = p.y - d.sy;
      if (!d.moved && Math.hypot(dx, dy) > CLICK_SLOP_PX) d.moved = true;
      if (d.moved) {
        view.current = { ...view.current, tx: d.tx0 + dx, ty: d.ty0 + dy };
        requestDraw();
      }
    }

    pointer.current = toFrame(p.x, p.y);
    latest.current.onMove?.(pointer.current);
    if (latest.current.loupe) requestDraw();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d && !d.moved && e.button === 0) {
      const p = local(e);
      latest.current.onClick?.(toFrame(p.x, p.y));
    }
    drag.current = null;
    if (pointers.current.size < 2) pinchDist.current = null;
  };

  const onPointerLeave = () => {
    pointer.current = null;
    latest.current.onMove?.(null);
    requestDraw();
  };

  return (
    <div className="site-canvas">
      <canvas
        ref={canvasRef}
        style={{ cursor, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
      />
      <button type="button" className="site-canvas-fit" onClick={fitView} disabled={!bounds}>
        Fit
      </button>
    </div>
  );
}
