import { longestEdgeDeg } from "@/trace/polygon";
import type { Carport, Mass, Point, Project, Surface } from "./project";
import { SCHEMA_VERSION } from "./project";

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

/** A 20x20 double carport with a clear span, 4:12 gable, 6x6 posts. */
export function defaultCarport(overrides: Partial<Carport> = {}): Carport {
  return {
    kind: "carport",
    id: newId("carport"),
    name: "Carport",
    position: [0, 0],
    rotationDeg: 0,
    type: "gable",
    widthFt: 20,
    depthFt: 20,
    plateHeightFt: 8,
    roofPitch: 4,
    overhangFt: { eave: 1, rake: 1 },
    posts: { size: "6x6", countAlongWidth: 2, countAlongDepth: 3, material: "pt-lumber", base: "surface-mount" },
    framing: { beamSize: "2x10", beamPly: 2, rafterSize: "2x8", rafterSpacingIn: 24 },
    roofing: "standing-seam",
    colors: { post: "#6b4f2a", trim: "#e8e4dc", roof: "#5b6168" },
    gableTruss: false,
    ground: { dropFt: 0, towardDeg: 0 },
    ...overrides,
  };
}

/** A house block. Rectangles default to a hip roof; anything else starts flat. */
export function defaultMass(footprint: Point[], name = "House"): Mass {
  const rect = footprint.length === 4;
  return {
    id: newId("mass"),
    name,
    footprint,
    baseElevation: 0,
    wallHeight: 10,
    roof: { type: rect ? "hip" : "flat", pitch: 6, ridgeAxisDeg: longestEdgeDeg(footprint), overhangFt: 1.5 },
    facade: null,
    color: "#b9a88f",
  };
}

export function defaultSurface(
  polygon: Point[],
  material: Surface["material"] = "concrete",
  name = "Driveway",
): Surface {
  return { id: newId("surface"), name, polygon, material };
}

export function defaultProject(): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId("project"),
    name: "Untitled project",
    createdAt: now,
    updatedAt: now,
    site: {
      tiles: [],
      scale: null,
      northOffsetDeg: 0,
      location: null,
      lot: { boundary: null, setbacks: null },
    },
    masses: [],
    surfaces: [],
    structures: [defaultCarport()],
    // Three.js coordinates (y up).
    view: { cameraPosition: [38, 24, 38], cameraTarget: [0, 6, 0] },
    notes: "",
  };
}
