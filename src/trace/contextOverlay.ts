/** Draws the project's 2D content over the aerial and hit-tests it. All input is site feet; drawn in frame px. */

import { drawHandle } from "@/calibrate/useLinePick";
import { SURFACE_COLORS } from "@/geometry/surface";
import type { Point, Project } from "@/schema/project";
import type { CanvasView } from "@/site/SiteCanvas";
import type { Selection } from "@/store/useUi";
import { centroid, pointInPolygon, rectCorners } from "./polygon";

export const HANDLE_SCREEN_PX = 8;

const STRUCTURE = "#f59e0b";

function path(ctx: CanvasRenderingContext2D, poly: readonly Point[], k: number) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x * k, y * k);
    else ctx.lineTo(x * k, y * k);
  });
  ctx.closePath();
}

export function drawContext(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  project: Project,
  pxPerFoot: number,
  selection: Selection | null,
) {
  const k = pxPerFoot;
  const lw = (n: number) => n / view.scale;
  ctx.save();
  ctx.font = `${12 / view.scale}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const s of project.surfaces) {
    const sel = selection?.kind === "surface" && selection.id === s.id;
    path(ctx, s.polygon, k);
    ctx.fillStyle = `${SURFACE_COLORS[s.material]}66`;
    ctx.fill();
    ctx.lineWidth = lw(sel ? 3 : 1.5);
    ctx.strokeStyle = sel ? "#ffffff" : "#6b6b66";
    ctx.stroke();
  }

  for (const m of project.masses) {
    const sel = selection?.kind === "mass" && selection.id === m.id;
    path(ctx, m.footprint, k);
    ctx.fillStyle = `${m.color}88`;
    ctx.fill();
    ctx.lineWidth = lw(sel ? 3 : 1.5);
    ctx.strokeStyle = sel ? "#ffffff" : "#1e1e1c";
    ctx.stroke();
    const c = centroid(m.footprint);
    ctx.fillStyle = "#1e1e1c";
    ctx.fillText(m.name, c[0] * k, c[1] * k);
  }

  if (project.site.lot.boundary) {
    path(ctx, project.site.lot.boundary, k);
    ctx.setLineDash([8 / view.scale, 5 / view.scale]);
    ctx.lineWidth = lw(2);
    ctx.strokeStyle = "#e11d48";
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const s of project.structures) {
    const sel = selection?.kind === "structure" && selection.id === s.id;
    const posts = rectCorners(s.position, s.rotationDeg, s.widthFt, s.depthFt);
    const roof = rectCorners(
      s.position,
      s.rotationDeg,
      s.widthFt + 2 * s.overhangFt.eave,
      s.depthFt + 2 * s.overhangFt.rake,
    );
    path(ctx, roof, k);
    ctx.setLineDash([5 / view.scale, 4 / view.scale]);
    ctx.lineWidth = lw(1.5);
    ctx.strokeStyle = STRUCTURE;
    ctx.stroke();
    ctx.setLineDash([]);
    path(ctx, posts, k);
    ctx.fillStyle = "rgba(245,158,11,0.3)";
    ctx.fill();
    ctx.lineWidth = lw(sel ? 3 : 2);
    ctx.strokeStyle = sel ? "#ffffff" : STRUCTURE;
    ctx.stroke();
    ctx.fillStyle = "#1e1e1c";
    ctx.fillText(s.name, s.position[0] * k, s.position[1] * k);
  }

  // corner handles on the selected shape
  const poly = selectedPolygon(project, selection);
  if (poly) for (const p of poly) drawHandle(ctx, view, [p[0] * k, p[1] * k], "#ffffff");
  ctx.restore();
}

/** The editable polygon of the selection, in site feet, or null for structures. */
export function selectedPolygon(project: Project, selection: Selection | null): readonly Point[] | null {
  if (!selection) return null;
  if (selection.kind === "mass") return project.masses.find((m) => m.id === selection.id)?.footprint ?? null;
  if (selection.kind === "surface") return project.surfaces.find((s) => s.id === selection.id)?.polygon ?? null;
  return null;
}

/** Index of the selected shape's corner under a frame-pixel point, if any. */
export function hitVertex(poly: readonly Point[], pxPerFoot: number, p: Point, viewScale: number): number {
  const tol = HANDLE_SCREEN_PX / viewScale;
  for (let i = 0; i < poly.length; i++) {
    const v = poly[i] as Point;
    if (Math.hypot(v[0] * pxPerFoot - p[0], v[1] * pxPerFoot - p[1]) <= tol) return i;
  }
  return -1;
}

/** Topmost object under a frame-pixel point: structures, then masses, then surfaces. */
export function hitTest(project: Project, pxPerFoot: number, p: Point): Selection | null {
  const f: Point = [p[0] / pxPerFoot, p[1] / pxPerFoot];
  for (const s of project.structures) {
    if (pointInPolygon(f, rectCorners(s.position, s.rotationDeg, s.widthFt, s.depthFt)))
      return { kind: "structure", id: s.id };
  }
  for (const m of [...project.masses].reverse()) {
    if (pointInPolygon(f, m.footprint)) return { kind: "mass", id: m.id };
  }
  for (const s of [...project.surfaces].reverse()) {
    if (pointInPolygon(f, s.polygon)) return { kind: "surface", id: s.id };
  }
  return null;
}
