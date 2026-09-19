import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteTool } from "@/calibrate/useCalibrateTool";
import { drawHandle, drawSegment } from "@/calibrate/useLinePick";
import type { Point } from "@/schema/project";
import type { OverlayFn } from "@/site/SiteCanvas";
import { rectFromEdgeAndPoint } from "./polygon";

interface Options {
  active: boolean;
  onComplete: (polygonPx: Point[]) => void;
}

const FILL = "rgba(14,165,233,0.18)";
const STROKE = "#0ea5e9";

/** Three clicks: one edge, then how deep. Handles rotated blocks naturally. */
export function useRectTool({ active, onComplete }: Options): SiteTool {
  const [pts, setPts] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);

  useEffect(() => {
    if (!active) {
      setPts([]);
      setHover(null);
    }
  }, [active]);

  const onClick = useCallback(
    (p: Point) => {
      if (pts.length < 2) {
        setPts([...pts, p]);
        return;
      }
      const [a, b] = pts as [Point, Point];
      const rect = rectFromEdgeAndPoint(a, b, p);
      setPts([]);
      onComplete(rect);
    },
    [pts, onComplete],
  );
  const onMove = useCallback((p: Point | null) => setHover(p), []);

  const overlay = useMemo<OverlayFn>(
    () => (ctx, view) => {
      const [a, b] = pts;
      if (a && !b && hover) drawSegment(ctx, view, a, hover, true);
      if (a && b) {
        const c = hover ?? b;
        const rect = rectFromEdgeAndPoint(a, b, c);
        ctx.save();
        ctx.beginPath();
        rect.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = FILL;
        ctx.fill();
        ctx.lineWidth = 2 / view.scale;
        ctx.strokeStyle = STROKE;
        ctx.stroke();
        ctx.restore();
      }
      for (const p of pts) drawHandle(ctx, view, p, STROKE);
    },
    [pts, hover],
  );

  const step = pts.length;
  const panel = (
    <section className="tool">
      <h2>Rectangle</h2>
      {step === 0 && <p>Click one corner of the block.</p>}
      {step === 1 && <p>Click the next corner along one wall. This sets the block's angle.</p>}
      {step === 2 && <p>Now click anywhere across the block to set how deep it is.</p>}
      <p className="hint">Escape cancels.</p>
    </section>
  );

  return { overlay, onClick, onMove, panel };
}
