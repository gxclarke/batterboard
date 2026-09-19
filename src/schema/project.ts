/**
 * The project contract. Zod schemas are the single source of truth; every
 * TypeScript type in the app is inferred from here. Never hand-write a
 * duplicate interface.
 *
 * Units and conventions (see docs/adr/0004-coordinate-conventions.md):
 * - Linear units are feet (decimal). Angles are degrees. Roof pitch is rise per 12.
 * - Site space is a 2D plane in feet: the aerial pixel frame divided by
 *   pxPerFoot. Origin is the first tile's top-left, +x right, +y down. Angles in site space are measured from
 *   +x toward +y, i.e. clockwise on screen.
 * - Site space is converted to Three.js in exactly one place: src/geometry/frame.ts.
 *
 * Every numeric field carries a physically sensible range. This is the guardrail
 * that keeps LLM output (and typos) from producing a 400-foot-tall carport.
 */
import { z } from "zod";

// ---------- primitives ----------

export const PointSchema = z.tuple([z.number().finite(), z.number().finite()]);
export type Point = z.infer<typeof PointSchema>;

export const Vec3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export type Vec3 = z.infer<typeof Vec3Schema>;

/** #rgb or #rrggbb */
export const ColorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "expected a hex color like #a1b2c3");

const Id = z.string().min(1).max(64);
const Name = z.string().min(1).max(120);
const IsoDate = z.string().datetime({ offset: true });

/** A closed polygon in site feet. Self-intersection is checked separately in trace/polygon.ts. */
export const PolygonSchema = z.array(PointSchema).min(3).max(500);

// ---------- site ----------

export const CalibrationSchema = z.object({
  p1: PointSchema, // shared pixel frame
  p2: PointSchema,
  knownFeet: z.number().min(1).max(500),
  label: z.string().max(80), // "garage door", "driveway width"
});

/**
 * One screenshot of the aerial. Several tiles taken at the same zoom compose
 * one image frame: `offsetPx` is the tile's top-left in that shared pixel
 * frame (the first tile sits at [0, 0]). See docs/adr/0008.
 */
export const AerialTileSchema = z.object({
  id: Id,
  name: z.string().max(80),
  blobKey: z.string().min(1), // IndexedDB key; never inline image data
  widthPx: z.number().int().min(16).max(20000),
  heightPx: z.number().int().min(16).max(20000),
  offsetPx: PointSchema,
});
export type AerialTile = z.infer<typeof AerialTileSchema>;

export const SiteSchema = z.object({
  tiles: z.array(AerialTileSchema).max(12),
  /** Pixel-frame to feet. Null until calibrated. Calibration points are in the shared pixel frame. */
  scale: z
    .object({
      pxPerFoot: z.number().min(0.1).max(500),
      calibration: CalibrationSchema,
    })
    .nullable(),
  /** Clockwise bearing of image-up from true north. 0 means a north-up screenshot. */
  northOffsetDeg: z.number().min(0).max(360),
  /** null disables the sun model. */
  location: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).nullable(),
  lot: z.object({
    boundary: PolygonSchema.nullable(),
    setbacks: z
      .object({
        front: z.number().min(0).max(100),
        rear: z.number().min(0).max(100),
        side: z.number().min(0).max(100),
      })
      .nullable(),
  }),
});
export type Site = z.infer<typeof SiteSchema>;

// ---------- context geometry: masses and surfaces ----------

export const MassRoofTypeSchema = z.enum(["gable", "hip", "shed", "flat"]);

export const MassSchema = z.object({
  id: Id,
  name: Name,
  footprint: PolygonSchema,
  baseElevation: z.number().min(-20).max(100), // feet above site datum
  wallHeight: z.number().min(4).max(80), // feet to eave
  roof: z.object({
    type: MassRoofTypeSchema,
    pitch: z.number().min(0).max(24),
    ridgeAxisDeg: z.number().min(0).max(360), // ignored for hip/flat
  }),
  facade: z
    .array(
      z.object({
        wallIndex: z.number().int().min(0),
        blobKey: z.string().min(1),
        corners: z.tuple([PointSchema, PointSchema, PointSchema, PointSchema]), // pixel coords in the photo
      }),
    )
    .nullable(),
  color: ColorSchema,
});
export type Mass = z.infer<typeof MassSchema>;

export const SurfaceMaterialSchema = z.enum(["concrete", "asphalt", "gravel", "grass", "pavers"]);

export const SurfaceSchema = z.object({
  id: Id,
  name: Name,
  polygon: PolygonSchema,
  material: SurfaceMaterialSchema,
});
export type Surface = z.infer<typeof SurfaceSchema>;

// ---------- structures ----------
//
// A project holds any number of structures. Each kind has its own parameter
// schema and its own deterministic generator (src/geometry/structures/*).
// Carport is the first kind; sheds, pergolas, decks, etc. are additional
// members of this union, not a refactor. See docs/adr/0002.

const StructureBase = {
  id: Id,
  name: Name,
  position: PointSchema, // center of footprint, site feet
  rotationDeg: z.number().min(0).max(360), // clockwise on screen, see conventions above
};

export const PostSizeSchema = z.enum(["4x4", "6x6", "8x8"]);
export const PostMaterialSchema = z.enum(["pt-lumber", "cedar", "steel"]);
export const PostBaseSchema = z.enum(["surface-mount", "embedded", "pier"]);
export const BeamSizeSchema = z.enum(["2x8", "2x10", "2x12", "4x10", "6x10", "lvl"]);
export const RafterSizeSchema = z.enum(["2x6", "2x8", "2x10", "2x12"]);
export const RafterSpacingSchema = z.union([z.literal(16), z.literal(24)]);
export const RoofingSchema = z.enum(["standing-seam", "corrugated-metal", "asphalt-shingle", "polycarbonate"]);
export const CarportRoofTypeSchema = z.enum(["gable", "shed", "hip"]);

/**
 * Carport framing convention (docs/adr/0003):
 * - Vehicles enter along depth. Post rows run along depth; there are no posts
 *   across the open ends.
 * - `countAlongWidth` is the number of post rows (2 = clear span).
 *   `countAlongDepth` is posts per row.
 * - Beams sit on each post row and run along depth. Rafters span the width.
 * - `widthFt` x `depthFt` is the out-to-out footprint of the posts. The roof
 *   extends past it by the overhangs.
 * - Gable and hip ridges run along depth. A shed roof slopes across the width,
 *   high side at local -x; `plateHeightFt` is the low-side bearing height.
 */
export const CarportSchema = z.object({
  ...StructureBase,
  kind: z.literal("carport"),
  type: CarportRoofTypeSchema,

  widthFt: z.number().min(8).max(40),
  depthFt: z.number().min(10).max(60),
  plateHeightFt: z.number().min(7).max(14), // grade to beam bearing
  roofPitch: z.number().min(0).max(12),
  overhangFt: z.object({ eave: z.number().min(0).max(4), rake: z.number().min(0).max(4) }),

  posts: z.object({
    size: PostSizeSchema,
    countAlongWidth: z.number().int().min(2).max(4),
    countAlongDepth: z.number().int().min(2).max(8),
    material: PostMaterialSchema,
    base: PostBaseSchema,
  }),

  framing: z.object({
    beamSize: BeamSizeSchema,
    beamPly: z.number().int().min(1).max(3),
    rafterSize: RafterSizeSchema,
    rafterSpacingIn: RafterSpacingSchema,
  }),

  roofing: RoofingSchema,
  colors: z.object({ post: ColorSchema, trim: ColorSchema, roof: ColorSchema }),
});
export type Carport = z.infer<typeof CarportSchema>;

export const StructureSchema = z.discriminatedUnion("kind", [CarportSchema]);
export type Structure = z.infer<typeof StructureSchema>;
export type StructureKind = Structure["kind"];

// ---------- project ----------

export const SCHEMA_VERSION = 1 as const;

export const ProjectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: Id,
  name: Name,
  createdAt: IsoDate,
  updatedAt: IsoDate,

  site: SiteSchema,
  masses: z.array(MassSchema).max(200),
  surfaces: z.array(SurfaceSchema).max(200),
  structures: z.array(StructureSchema).max(50),

  view: z.object({ cameraPosition: Vec3Schema, cameraTarget: Vec3Schema }),
  notes: z.string().max(20000),
});
export type Project = z.infer<typeof ProjectSchema>;

// ---------- migration ----------

/**
 * Bring a stored project of any prior schema version up to the current one,
 * then validate. Currently a no-op for version 1; present from day one so a
 * future version 2 never breaks saved projects.
 */
export function migrate(raw: unknown): Project {
  const version =
    typeof raw === "object" && raw !== null ? (raw as { schemaVersion?: unknown }).schemaVersion : undefined;
  if (version === undefined) {
    throw new Error("Not a Batterboard project: missing schemaVersion");
  }
  if (typeof version !== "number" || version > SCHEMA_VERSION) {
    throw new Error(`Project schemaVersion ${String(version)} is newer than this app supports (${SCHEMA_VERSION})`);
  }
  // Future: if (version === 1) raw = migrateV1toV2(raw); ...
  return ProjectSchema.parse(raw);
}
