/**
 * Reality checks: plain-language advisories about a design. Pure.
 * Never a hard block, never a compliance claim (see the disclaimer in the panel).
 */

import { formatFeet } from "@/calibrate/scale";
import { lumber } from "@/geometry/lumber";
import { layoutCarport } from "@/geometry/structures/carport";
import type { Carport, Mass, Project, Structure } from "@/schema/project";
import { distanceToOutline, pointInPolygon, polygonGap, polygonsIntersect, rectCorners } from "@/trace/polygon";
import { maxBeamSpanFt, maxRafterSpanFt } from "./spans";

export type Severity = "warn" | "info";

export interface Warning {
  id: string;
  structureId: string;
  severity: Severity;
  title: string;
  detail: string;
}

export const DISCLAIMER =
  "Batterboard is a concept tool. These notes come from simplified span tables and rules of thumb, not from your local code or an engineer. Use them to spot problems early, then confirm with a builder.";

export function runChecks(project: Project): Warning[] {
  const out: Warning[] = [];
  for (const s of project.structures) {
    if (s.kind === "carport") out.push(...checkCarport(s, project));
  }
  return out;
}

function checkCarport(c: Carport, project: Project): Warning[] {
  const w: Warning[] = [];
  const add = (id: string, severity: Severity, title: string, detail: string) =>
    w.push({ id: `${c.id}:${id}`, structureId: c.id, severity, title, detail });

  const post = lumber(c.posts.size).depthFt;
  const rows = c.posts.countAlongWidth;
  const perRow = c.posts.countAlongDepth;

  // --- rafters: horizontal span from bearing to ridge (gable, hip) or across the width (shed)
  const rafterSpan = c.type === "shed" ? c.widthFt - post : (c.widthFt - post) / rows;
  const rafterMax = maxRafterSpanFt(c.framing.rafterSize, c.framing.rafterSpacingIn);
  if (rafterSpan > rafterMax) {
    add(
      "rafter-span",
      "warn",
      `${c.framing.rafterSize} rafters are spanning ${formatFeet(rafterSpan)}`,
      `At ${c.framing.rafterSpacingIn}" spacing that size is usually good to about ${formatFeet(rafterMax)}. Use a deeper rafter, tighten the spacing to 16", or add a post row.`,
    );
  }

  // --- beams: clear span between posts along the row, carrying a tributary strip of roof
  const beamSpan = (c.depthFt - post) / (perRow - 1) - post;
  const tributary = rows === 2 ? c.widthFt / 2 + c.overhangFt.eave : c.widthFt / (rows - 1);
  const beamMax = maxBeamSpanFt(c.framing.beamSize, c.framing.beamPly, tributary);
  if (beamSpan > beamMax) {
    const beamName = `${c.framing.beamPly > 1 ? `${c.framing.beamPly}-ply ` : ""}${c.framing.beamSize}`;
    add(
      "beam-span",
      "warn",
      `Posts are ${formatFeet(beamSpan)} apart under a ${beamName} beam`,
      `Carrying about ${formatFeet(tributary)} of roof, that beam is usually good to about ${formatFeet(beamMax)} between posts. Add a post per row, add a ply, or step up the beam.`,
    );
  }

  // --- posts
  if (c.posts.size === "4x4") {
    add(
      "post-size",
      "warn",
      "4x4 posts are light for a carport",
      "6x6 is the norm for a freestanding roof. 4x4 reads flimsy and is hard to brace well.",
    );
  }
  if (c.posts.size !== "4x4" && c.plateHeightFt > 11 && c.posts.size === "6x6") {
    add(
      "post-height",
      "info",
      "Tall 6x6 posts",
      `At ${formatFeet(c.plateHeightFt)} to the beam, 6x6 posts start to feel slender. 8x8 or extra bracing looks more convincing.`,
    );
  }

  // --- plate height
  if (c.plateHeightFt < 7.5) {
    add(
      "plate-low",
      "warn",
      `Only ${formatFeet(c.plateHeightFt)} under the beams`,
      "A minivan or SUV wants about 7 ft clear plus a margin, and the beam hangs below the plate height. 8 ft is a comfortable minimum.",
    );
  } else if (c.plateHeightFt > 12) {
    add(
      "plate-high",
      "info",
      `${formatFeet(c.plateHeightFt)} to the beams is unusually tall`,
      "Fine for an RV. For cars it looks out of scale next to a house.",
    );
  }

  // --- site relationships
  const roof = rectCorners(
    c.position,
    c.rotationDeg,
    c.widthFt + 2 * c.overhangFt.eave,
    c.depthFt + 2 * (c.type === "hip" ? c.overhangFt.eave : c.overhangFt.rake),
  );
  const heights = layoutCarport(c).heights;

  for (const m of project.masses) {
    const relation = relationTo(roof, heights, m);
    if (relation) add(`mass-${m.id}`, relation.severity, relation.title, relation.detail);
  }

  const boundary = project.site.lot.boundary;
  if (boundary) {
    const outside = roof.some((p) => !pointInPolygon(p, boundary));
    if (outside) {
      add(
        "lot-outside",
        "warn",
        "The roof crosses the lot line",
        "Part of the roof outline is outside the traced lot boundary.",
      );
    } else if (project.site.lot.setbacks) {
      const sb = project.site.lot.setbacks;
      const required = Math.min(sb.front, sb.rear, sb.side);
      const nearest = Math.min(...roof.map((p) => distanceToOutline(p, boundary)));
      if (nearest < required) {
        add(
          "setback",
          "warn",
          `The roof comes within ${formatFeet(nearest)} of the lot line`,
          `Your setbacks call for at least ${formatFeet(required)}. Setbacks are measured to the roof edge in many places, so this may need to move.`,
        );
      }
    }
  }

  return w;
}

function relationTo(
  roof: readonly [number, number][],
  heights: { peakFt: number; eaveUndersideFt: number },
  m: Mass,
): { severity: Severity; title: string; detail: string } | null {
  const eaveTop = m.baseElevation + m.wallHeight;
  if (polygonsIntersect(roof, m.footprint)) {
    if (heights.peakFt > eaveTop) {
      return {
        severity: "warn",
        title: `The roof runs into ${m.name}`,
        detail: `The carport roof overlaps ${m.name}'s footprint and rises to ${formatFeet(heights.peakFt)}, above its ${formatFeet(eaveTop)} eave. Move it out, lower it, or make it an attached roof (a different structure).`,
      };
    }
    return {
      severity: "warn",
      title: `The roof overlaps ${m.name}`,
      detail: `Part of the carport roof sits over ${m.name}'s footprint.`,
    };
  }
  const gap = polygonGap(roof, m.footprint);
  if (gap < 1.5 && heights.peakFt > eaveTop - 1) {
    return {
      severity: "info",
      title: `Tight against ${m.name}`,
      detail: `The roof edge is ${formatFeet(gap)} from ${m.name}. ${m.name}'s own eave overhang and gutters live in that space; leave 2 to 3 ft or plan the flashing.`,
    };
  }
  return null;
}

/** Warnings for one structure. */
export function warningsFor(project: Project, structure: Structure): Warning[] {
  return runChecks(project).filter((w) => w.structureId === structure.id);
}
