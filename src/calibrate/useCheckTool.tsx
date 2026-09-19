import { useState } from "react";
import { deltaPercent, feetBetween, formatFeet } from "./scale";
import type { SiteTool } from "./useCalibrateTool";
import { useLinePick } from "./useLinePick";

interface Options {
  active: boolean;
  pxPerFoot: number | null;
  calibrationLabel: string | null;
  onDone: () => void;
  onRecalibrate: () => void;
}

const WARN_PCT = 5;

/** Measure something else and let the user judge whether the scale is right. */
export function useCheckTool({ active, pxPerFoot, calibrationLabel, onDone, onRecalibrate }: Options): SiteTool {
  const pick = useLinePick(active);
  const [actual, setActual] = useState("");

  const [p1, p2] = pick.pts;
  const measured = p1 && p2 && pxPerFoot ? feetBetween(p1, p2, pxPerFoot) : null;
  const actualNum = Number.parseFloat(actual);
  const delta =
    measured !== null && Number.isFinite(actualNum) && actualNum > 0 ? deltaPercent(measured, actualNum) : null;

  const panel = (
    <section className="tool">
      <h2>Cross-check the scale</h2>
      {calibrationLabel && (
        <p className="muted">
          Scale is set from <em>{calibrationLabel}</em>.
        </p>
      )}
      {pick.pts.length < 2 && <p>Click both ends of something else: the driveway width, the pool, a car.</p>}
      {measured !== null && (
        <>
          <p>
            That measures <strong>{formatFeet(measured)}</strong>. Does that look right?
          </p>
          <label>
            <span>Real length (ft), if known</span>
            <input
              type="number"
              min={1}
              max={500}
              step={0.1}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              placeholder="optional"
            />
          </label>
          {delta !== null && (
            <p className={Math.abs(delta) > WARN_PCT ? "warn" : "ok"}>
              {Math.abs(delta) > WARN_PCT
                ? `That is ${Math.abs(delta).toFixed(1)}% off. A 10% scale error makes everything subtly wrong. Recalibrate on a longer, clearer edge.`
                : `Within ${Math.abs(delta).toFixed(1)}%. Good enough for concept work.`}
            </p>
          )}
        </>
      )}
      <div className="row">
        <button type="button" className="primary" onClick={onDone}>
          Looks right
        </button>
        <button type="button" onClick={onRecalibrate}>
          Recalibrate
        </button>
        {pick.pts.length > 0 && (
          <button type="button" onClick={pick.reset}>
            Measure again
          </button>
        )}
      </div>
    </section>
  );

  return { overlay: pick.overlay, onClick: pick.onClick, onMove: pick.onMove, panel };
}
