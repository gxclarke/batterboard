import { type ReactNode, useState } from "react";
import type { Point } from "@/schema/project";
import type { CanvasView, OverlayFn } from "@/site/SiteCanvas";
import { useProject } from "@/store/useProject";
import { KNOWN_DIMENSIONS } from "./knownDimensions";
import { pxDistance } from "./scale";
import { useLinePick } from "./useLinePick";

export interface SiteTool {
  overlay: OverlayFn;
  onClick: (p: Point, view: CanvasView) => void;
  onMove: (p: Point | null, view: CanvasView) => void;
  panel: ReactNode;
}

interface Options {
  active: boolean;
  onDone: () => void;
  onCancel: () => void;
}

/** Drag a line across something of known size, tell us the size, get pxPerFoot. */
export function useCalibrateTool({ active, onDone, onCancel }: Options): SiteTool {
  const pick = useLinePick(active);
  const commit = useProject((s) => s.commit);
  const [choice, setChoice] = useState(0);
  const [feet, setFeet] = useState("");
  const [label, setLabel] = useState("");

  const [p1, p2] = pick.pts;
  const px = p1 && p2 ? pxDistance(p1, p2) : null;
  const feetNum = Number.parseFloat(feet);
  const canApply = px !== null && px >= 4 && Number.isFinite(feetNum) && feetNum >= 1 && feetNum <= 500;

  const choose = (index: number) => {
    setChoice(index);
    const k = KNOWN_DIMENSIONS[index];
    if (k?.feet != null) {
      setFeet(String(k.feet));
      setLabel(k.label.replace(/,\s*[\d.]+ ft$/, ""));
    } else {
      setFeet("");
      setLabel("");
    }
  };

  const apply = () => {
    if (!canApply || !p1 || !p2 || px === null) return;
    commit("calibrate scale", (d) => {
      d.site.scale = {
        pxPerFoot: px / feetNum,
        calibration: { p1, p2, knownFeet: feetNum, label: label.trim() || "known dimension" },
      };
    });
    onDone();
  };

  const step = pick.pts.length;
  const panel = (
    <section className="tool">
      <h2>Calibrate scale</h2>
      {step === 0 && <p>Click one end of something whose real size you know. A garage door, a parking pad, a car.</p>}
      {step === 1 && <p>Now click the other end. Zoom in with the wheel and use the magnifier to hit the edge.</p>}
      {step === 2 && px !== null && (
        <>
          <p>
            That line is <strong>{px.toFixed(0)} px</strong> long. How long is it really?
          </p>
          <label>
            <span>Reference</span>
            <select value={choice} onChange={(e) => choose(Number(e.target.value))}>
              {KNOWN_DIMENSIONS.map((k, i) => (
                <option key={k.label} value={i}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Length (ft)</span>
            <input
              type="number"
              min={1}
              max={500}
              step={0.1}
              value={feet}
              onChange={(e) => setFeet(e.target.value)}
              placeholder="e.g. 24"
            />
          </label>
          <label>
            <span>What is it?</span>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="driveway width" />
          </label>
          <div className="row">
            <button type="button" className="primary" onClick={apply} disabled={!canApply}>
              Set scale
            </button>
            <button type="button" onClick={pick.reset}>
              Start over
            </button>
          </div>
        </>
      )}
      <div className="row">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );

  return { overlay: pick.overlay, onClick: pick.onClick, onMove: pick.onMove, panel };
}
