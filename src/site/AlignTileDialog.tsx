import { useCallback, useMemo, useState } from "react";
import { type Bounds, tileOffsetFromMatch } from "@/calibrate/scale";
import { drawHandle } from "@/calibrate/useLinePick";
import type { AerialTile, Point } from "@/schema/project";
import { type OverlayFn, SiteCanvas } from "./SiteCanvas";
import type { TileImage } from "./useTileImages";

interface Props {
  existing: TileImage[];
  bounds: Bounds;
  image: HTMLImageElement;
  width: number;
  height: number;
  onCancel: () => void;
  onDone: (offsetPx: Point) => void;
}

const MATCH_COLOR = "#38bdf8";

/** Register a new screenshot against the existing composite by one shared feature. */
export function AlignTileDialog({ existing, bounds, image, width, height, onCancel, onDone }: Props) {
  const [inFrame, setInFrame] = useState<Point | null>(null);
  const [inTile, setInTile] = useState<Point | null>(null);

  const tempTile = useMemo<AerialTile>(
    () => ({ id: "pending", name: "new", blobKey: "pending", widthPx: width, heightPx: height, offsetPx: [0, 0] }),
    [width, height],
  );
  const newImages = useMemo<TileImage[]>(() => [{ tile: tempTile, image }], [tempTile, image]);
  const newBounds = useMemo<Bounds>(() => ({ minX: 0, minY: 0, maxX: width, maxY: height }), [width, height]);

  const overlayFor = useCallback(
    (p: Point | null): OverlayFn =>
      (ctx, view) => {
        if (p) drawHandle(ctx, view, p, MATCH_COLOR);
      },
    [],
  );
  const leftOverlay = useMemo(() => overlayFor(inFrame), [overlayFor, inFrame]);
  const rightOverlay = useMemo(() => overlayFor(inTile), [overlayFor, inTile]);

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide">
        <header>
          <h2>Line up the new screenshot</h2>
          <p className="muted">
            Click the same feature in both images, for example a roof corner or the end of a driveway joint. Both
            screenshots must be at the same zoom level.
          </p>
        </header>
        <div className="align-stage">
          <div>
            <h3>Existing {inFrame ? "✓" : ""}</h3>
            <SiteCanvas
              images={existing}
              bounds={bounds}
              overlay={leftOverlay}
              onClick={setInFrame}
              loupe
              cursor="crosshair"
            />
          </div>
          <div>
            <h3>New screenshot {inTile ? "✓" : ""}</h3>
            <SiteCanvas
              images={newImages}
              bounds={newBounds}
              overlay={rightOverlay}
              onClick={setInTile}
              loupe
              cursor="crosshair"
            />
          </div>
        </div>
        <footer className="row">
          <button
            type="button"
            className="primary"
            disabled={!inFrame || !inTile}
            onClick={() => inFrame && inTile && onDone(tileOffsetFromMatch(inFrame, inTile))}
          >
            Add screenshot
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}
