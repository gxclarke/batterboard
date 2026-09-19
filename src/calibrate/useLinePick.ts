import { useCallback, useEffect, useMemo, useState } from "react";
import type { Point } from "@/schema/project";
import type { CanvasView, OverlayFn } from "@/site/SiteCanvas";

export const PICK_COLOR = "#f59e0b";

/** Two-click line picking shared by calibration and cross-check. */
export function useLinePick(active: boolean) {
  const [pts, setPts] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);

  useEffect(() => {
    if (!active) {
      setPts([]);
      setHover(null);
    }
  }, [active]);

  const onClick = useCallback((p: Point) => setPts((prev) => (prev.length >= 2 ? [p] : [...prev, p])), []);
  const onMove = useCallback((p: Point | null) => setHover(p), []);
  const reset = useCallback(() => setPts([]), []);

  const overlay = useMemo<OverlayFn>(
    () => (ctx, view) => {
      const a = pts[0];
      const b = pts[1] ?? (pts.length === 1 ? hover : null);
      if (a && b) drawSegment(ctx, view, a, b, pts.length < 2);
      for (const p of pts) drawHandle(ctx, view, p);
    },
    [pts, hover],
  );

  return { pts, hover, onClick, onMove, overlay, reset };
}

export function drawSegment(ctx: CanvasRenderingContext2D, view: CanvasView, a: Point, b: Point, dashed: boolean) {
  ctx.save();
  ctx.lineWidth = 2 / view.scale;
  ctx.strokeStyle = PICK_COLOR;
  ctx.setLineDash(dashed ? [6 / view.scale, 4 / view.scale] : []);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
  ctx.restore();
}

export function drawHandle(ctx: CanvasRenderingContext2D, view: CanvasView, p: Point, color = PICK_COLOR) {
  ctx.save();
  ctx.lineWidth = 2 / view.scale;
  ctx.strokeStyle = color;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(p[0], p[1], 5 / view.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p[0] - 9 / view.scale, p[1]);
  ctx.lineTo(p[0] + 9 / view.scale, p[1]);
  ctx.moveTo(p[0], p[1] - 9 / view.scale);
  ctx.lineTo(p[0], p[1] + 9 / view.scale);
  ctx.stroke();
  ctx.restore();
}
