import { useCallback, useEffect, useMemo, useState } from "react";
import type { SiteTool } from "@/calibrate/useCalibrateTool";
import { drawHandle, drawSegment } from "@/calibrate/useLinePick";
import type { Point } from "@/schema/project";
import type { CanvasView, OverlayFn } from "@/site/SiteCanvas";
import { chainWouldCross, distance, isSimplePolygon } from "./polygon";

interface Options {
  active: boolean;
  title: string;
  onComplete: (polygonPx: Point[]) => void;
}

const CLOSE_TOL_SCREEN_PX = 12;
const FILL = "rgba(14,165,233,0.18)";
const STROKE = "#0ea5e9";
const BAD = "#dc2626";

/** Click points; click the first point, press Enter, or double-click to close. Crossings are refused. */
export function usePolygonTool({ active, title, onComplete }: Options): SiteTool {
  const [pts, setPts] = useState<Point[]>([]);
  const [hover, setHover] = useState<Point | null>(null);
  const [bad, setBad] = useState(false);

  useEffect(() => {
    if (!active) {
      setPts([]);
      setHover(null);
      setBad(false);
    }
  }, [active]);

  const close = useCallback(() => {
    if (pts.length >= 3 && isSimplePolygon(pts)) {
      onComplete(pts);
      setPts([]);
    } else {
      setBad(true);
    }
  }, [pts, onComplete]);

  const onClick = useCallback(
    (p: Point, view: CanvasView) => {
      const first = pts[0];
      if (first && pts.length >= 3 && distance(p, first) * view.scale < CLOSE_TOL_SCREEN_PX) {
        close();
        return;
      }
      if (chainWouldCross(pts, p)) {
        setBad(true);
        return;
      }
      setBad(false);
      setPts([...pts, p]);
    },
    [pts, close],
  );
  const onMove = useCallback((p: Point | null) => setHover(p), []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "Enter") close();
      if (e.key === "Backspace") {
        e.preventDefault();
        setPts((prev) => prev.slice(0, -1));
        setBad(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, close]);

  const overlay = useMemo<OverlayFn>(
    () => (ctx, view) => {
      if (pts.length >= 2) {
        ctx.save();
        ctx.beginPath();
        pts.forEach(([x, y], i) => {
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        if (pts.length >= 3) {
          ctx.closePath();
          ctx.fillStyle = FILL;
          ctx.fill();
        }
        ctx.lineWidth = 2 / view.scale;
        ctx.strokeStyle = bad ? BAD : STROKE;
        ctx.stroke();
        ctx.restore();
      }
      const last = pts[pts.length - 1];
      if (last && hover) {
        const crosses = chainWouldCross(pts, hover);
        ctx.save();
        ctx.strokeStyle = crosses ? BAD : STROKE;
        drawSegment(ctx, view, last, hover, true);
        ctx.restore();
      }
      pts.forEach((p, i) => {
        drawHandle(ctx, view, p, i === 0 && pts.length >= 3 ? "#16a34a" : STROKE);
      });
    },
    [pts, hover, bad],
  );

  const panel = (
    <section className="tool">
      <h2>{title}</h2>
      {pts.length === 0 && <p>Click the corners in order around the outline.</p>}
      {pts.length > 0 && pts.length < 3 && <p>Keep going. Backspace removes the last point.</p>}
      {pts.length >= 3 && <p>Click the green first point or press Enter to close.</p>}
      {bad && <p className="warn">That edge would cross another. Pick a different point or Backspace.</p>}
      <div className="row">
        <button type="button" className="primary" onClick={close} disabled={pts.length < 3}>
          Close shape
        </button>
      </div>
    </section>
  );

  return { overlay, onClick, onMove, panel };
}
