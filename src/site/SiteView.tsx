/**
 * The 2D site mode: import screenshots, line them up, calibrate scale.
 * Tracing joins this view in the next slice.
 */
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compositeBounds, formatFeet } from "@/calibrate/scale";
import { useCalibrateTool } from "@/calibrate/useCalibrateTool";
import { useCheckTool } from "@/calibrate/useCheckTool";
import { drawSegment } from "@/calibrate/useLinePick";
import { newId } from "@/schema/defaults";
import type { AerialTile, Point } from "@/schema/project";
import { putBlob } from "@/store/persistence";
import { useProject } from "@/store/useProject";
import { AlignTileDialog } from "./AlignTileDialog";
import { CropDialog } from "./CropDialog";
import { imageFileFrom, isImageFile, loadImage } from "./images";
import { type OverlayFn, SiteCanvas } from "./SiteCanvas";
import { useTileImages } from "./useTileImages";

type ToolId = "none" | "calibrate" | "check";
type Pending =
  | { kind: "crop"; file: File }
  | { kind: "align"; blob: Blob; image: HTMLImageElement; width: number; height: number; name: string };

const MIN_WIDTH = 800;

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => window.innerWidth < MIN_WIDTH);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MIN_WIDTH - 1}px)`);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

export function SiteView() {
  const site = useProject((s) => s.project.site);
  const commit = useProject((s) => s.commit);
  const tiles = site.tiles;
  const images = useTileImages(tiles);
  const bounds = useMemo(() => compositeBounds(tiles), [tiles]);
  const narrow = useNarrow();

  const [tool, setTool] = useState<ToolId>("none");
  const [pending, setPending] = useState<Pending | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // ----- importing -----
  const beginImport = useCallback((file: File) => setPending({ kind: "crop", file }), []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = imageFileFrom(e.clipboardData?.items);
      if (f) {
        e.preventDefault();
        beginImport(f);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [beginImport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTool("none");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const addTile = async (blob: Blob, width: number, height: number, name: string, offsetPx: Point) => {
    const id = newId("tile");
    const blobKey = `aerial_${id}`;
    await putBlob(blobKey, blob);
    commit("add aerial", (d) => {
      d.site.tiles.push({ id, name, blobKey, widthPx: width, heightPx: height, offsetPx });
    });
  };

  const onCropped = async (result: { blob: Blob; width: number; height: number }, name: string) => {
    if (tiles.length === 0) {
      await addTile(result.blob, result.width, result.height, name, [0, 0]);
      setPending(null);
    } else {
      const image = await loadImage(result.blob);
      setPending({ kind: "align", image, name, ...result });
    }
  };

  const removeTile = (tile: AerialTile) => {
    // The blob stays until the next load, so undo can bring the tile back.
    commit("remove aerial", (d) => {
      d.site.tiles = d.site.tiles.filter((t) => t.id !== tile.id);
    });
  };

  // ----- tools -----
  const calibrate = useCalibrateTool({
    active: tool === "calibrate",
    onDone: () => setTool("check"),
    onCancel: () => setTool("none"),
  });
  const check = useCheckTool({
    active: tool === "check",
    pxPerFoot: site.scale?.pxPerFoot ?? null,
    calibrationLabel: site.scale ? `${site.scale.calibration.label}, ${site.scale.calibration.knownFeet} ft` : null,
    onDone: () => setTool("none"),
    onRecalibrate: () => setTool("calibrate"),
  });
  const activeTool = tool === "calibrate" ? calibrate : tool === "check" ? check : null;
  const toolOverlay = activeTool?.overlay;

  const overlay = useCallback<OverlayFn>(
    (ctx, view) => {
      ctx.save();
      ctx.lineWidth = 1 / view.scale;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      for (const t of tiles) ctx.strokeRect(t.offsetPx[0], t.offsetPx[1], t.widthPx, t.heightPx);
      ctx.restore();
      if (site.scale && tool === "none") {
        const { p1, p2 } = site.scale.calibration;
        ctx.save();
        ctx.globalAlpha = 0.6;
        drawSegment(ctx, view, p1, p2, false);
        ctx.restore();
      }
      toolOverlay?.(ctx, view);
    },
    [tiles, site.scale, tool, toolOverlay],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = imageFileFrom(e.dataTransfer.items) ?? Array.from(e.dataTransfer.files).find(isImageFile);
    if (f) beginImport(f);
  };

  if (narrow) {
    return (
      <div className="gate">
        <h2>Site setup needs a bigger screen</h2>
        <p>
          Calibrating and tracing an aerial with a fingertip is not something we want to ship badly. Open Batterboard on
          a laptop or tablet to set up the site. The 3D view works here.
        </p>
      </div>
    );
  }

  const pickFile = () => fileInput.current?.click();

  return (
    <div className="site-view">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drop target only; the Add button is the keyboard path */}
      <div className="site-stage" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        {tiles.length === 0 ? (
          <EmptyState onPick={pickFile} />
        ) : (
          <SiteCanvas
            images={images}
            bounds={bounds}
            overlay={overlay}
            onClick={activeTool?.onClick}
            onMove={activeTool?.onMove}
            loupe={activeTool !== null}
            cursor={activeTool ? "crosshair" : "grab"}
          />
        )}
      </div>

      <aside className="panel">
        {activeTool?.panel}

        <Section title="Aerial">
          {tiles.length === 0 && <p className="muted">No screenshot yet.</p>}
          <ul className="tiles">
            {tiles.map((t, i) => (
              <li key={t.id}>
                <span>
                  {i + 1}. {t.name}{" "}
                  <small className="muted">
                    {t.widthPx}×{t.heightPx}
                  </small>
                </span>
                <button type="button" onClick={() => removeTile(t)} title="Remove">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" onClick={pickFile}>
              {tiles.length === 0 ? "Add screenshot" : "Add another"}
            </button>
          </div>
          <p className="hint">
            Take a satellite screenshot with north up. You can also paste one or drop it onto the map. Add more at the
            same zoom to cover a big lot.
          </p>
        </Section>

        <Section title="Scale">
          {site.scale ? (
            <p>
              <strong>{site.scale.pxPerFoot.toFixed(2)} px/ft</strong>
              <br />
              <span className="muted">
                from {site.scale.calibration.label}, {formatFeet(site.scale.calibration.knownFeet)}
              </span>
            </p>
          ) : (
            <p className="muted">Not calibrated. Every measurement depends on this step.</p>
          )}
          <div className="row">
            <button
              type="button"
              className={site.scale ? "" : "primary"}
              disabled={tiles.length === 0 || tool === "calibrate"}
              onClick={() => setTool("calibrate")}
            >
              {site.scale ? "Recalibrate" : "Calibrate"}
            </button>
            {site.scale && (
              <button type="button" disabled={tool === "check"} onClick={() => setTool("check")}>
                Cross-check
              </button>
            )}
          </div>
        </Section>

        <Section title="North">
          <label>
            <span>Image-up bearing (deg)</span>
            <input
              type="number"
              min={0}
              max={360}
              step={1}
              value={site.northOffsetDeg}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (Number.isFinite(v)) {
                  commit("set north", (d) => {
                    d.site.northOffsetDeg = v;
                  });
                }
              }}
            />
          </label>
          <p className="hint">0 means the map compass pointed straight up when you took the screenshot.</p>
        </Section>
      </aside>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) beginImport(f);
          e.target.value = "";
        }}
      />

      {pending?.kind === "crop" && (
        <CropDialog
          file={pending.file}
          onCancel={() => setPending(null)}
          onDone={(r) => onCropped(r, pending.file.name.replace(/\.[^.]+$/, "") || "screenshot")}
        />
      )}
      {pending?.kind === "align" && bounds && (
        <AlignTileDialog
          existing={images}
          bounds={bounds}
          image={pending.image}
          width={pending.width}
          height={pending.height}
          onCancel={() => setPending(null)}
          onDone={async (offsetPx) => {
            await addTile(pending.blob, pending.width, pending.height, pending.name, offsetPx);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="empty">
      <h2>Start with a satellite screenshot</h2>
      <ol>
        <li>Open Apple Maps or Google Maps in satellite view and find your house.</li>
        <li>Zoom in until roofs are crisp, with north up.</li>
        <li>Take a screenshot and add it here. Paste, drop, or pick a file.</li>
      </ol>
      <button type="button" className="primary" onClick={onPick}>
        Add screenshot
      </button>
    </div>
  );
}
