/**
 * The only thing the language model is allowed to produce: a partial Carport.
 * Everything here is pure. The Worker validates with the same schema before
 * answering; the client validates again, merges, re-validates the whole
 * carport, and commits one undoable step.
 */
import { z } from "zod";
// Relative import on purpose: the Worker bundles this file without the `@/` alias.
import { type Carport, CarportSchema } from "../schema/project";

const S = CarportSchema.shape;

/** Every field the model may change. Nested groups may be partial: the client merges key by key. */
const PATCH_SHAPE = {
  name: S.name,
  type: S.type,
  widthFt: S.widthFt,
  depthFt: S.depthFt,
  plateHeightFt: S.plateHeightFt,
  roofPitch: S.roofPitch,
  rotationDeg: S.rotationDeg,
  /** Object rather than a tuple so it can be addressed as position.x / position.y. */
  position: z.object({ x: z.number().min(-2000).max(2000), y: z.number().min(-2000).max(2000) }).partial(),
  overhangFt: S.overhangFt.partial(),
  posts: S.posts.partial(),
  framing: S.framing.partial(),
  roofing: S.roofing,
  colors: S.colors.partial(),
  gableTruss: z.boolean(),
  ground: z.object({ dropFt: z.number().min(0).max(6), towardDeg: z.number().min(0).max(360) }).partial(),
};

/** The patch as the client applies it: only the keys that change are present. */
export const CarportPatchSchema = z.object(PATCH_SHAPE).partial().strict();
export type CarportPatch = z.infer<typeof CarportPatchSchema>;

/** What the Worker returns. `patch` is null when the model only has something to say. */
export const AssistantReplySchema = z.object({
  patch: CarportPatchSchema.nullable(),
  message: z.string().max(2000),
});
export type AssistantReply = z.infer<typeof AssistantReplySchema>;

/* ------------------------------------------------------------------------------------------------
 * Wire format for structured output.
 *
 * The API compiles the output schema to a grammar and rejects anything with more than 24 optional
 * properties or 16 union-typed (incl. nullable) properties, and called 15 flat optionals "too
 * complex". A sparse object patch cannot fit. So the model emits a list of {field, value} changes:
 * no optionals, no unions, and the grammar is tiny. `fromWire` turns it back into a CarportPatch.
 * ---------------------------------------------------------------------------------------------- */

type Leaf = z.ZodType;

function isObjectSchema(schema: z.ZodType): schema is z.ZodObject {
  return schema.def.type === "object";
}

/** Leaf schemas by dotted path: "widthFt", "framing.rafterSpacingIn", "position.x", ... */
const LEAVES: Record<string, Leaf> = {};
for (const [key, schema] of Object.entries(PATCH_SHAPE)) {
  if (isObjectSchema(schema)) {
    for (const [sub, leaf] of Object.entries(schema.shape)) LEAVES[`${key}.${sub}`] = leaf as Leaf;
  } else {
    LEAVES[key] = schema;
  }
}
export const PATCH_FIELDS = Object.keys(LEAVES) as [string, ...string[]];

export const AssistantReplyWireSchema = z.object({
  changes: z
    .array(
      z.object({
        field: z.enum(PATCH_FIELDS).describe("One of the listed field paths."),
        value: z
          .string()
          .max(200)
          .describe(
            "The new value as text: a number like 24 or 3.5, true or false, a color like #2f4f3f, or an option name.",
          ),
      }),
    )
    .max(40)
    .describe("Empty when nothing should change."),
  message: z.string().max(2000),
});
export type AssistantReplyWire = z.infer<typeof AssistantReplyWireSchema>;

/** Text to the type the leaf schema expects. Strings stay strings; everything else is parsed as JSON. */
function coerce(leaf: Leaf, text: string): unknown {
  const kind = leaf.def.type;
  if (kind === "string" || kind === "enum") return text.trim();
  try {
    return JSON.parse(text.trim());
  } catch {
    return text.trim();
  }
}

/** Build the sparse patch. Throws a zod error when a value does not fit its field. */
export function fromWire(wire: AssistantReplyWire): AssistantReply {
  if (wire.changes.length === 0) return { patch: null, message: wire.message };
  const raw: Record<string, unknown> = {};
  for (const { field, value } of wire.changes) {
    const leaf = LEAVES[field];
    if (!leaf) continue;
    const coerced = coerce(leaf, value);
    const dot = field.indexOf(".");
    if (dot === -1) {
      raw[field] = coerced;
    } else {
      const group = field.slice(0, dot);
      const sub = field.slice(dot + 1);
      const target = (raw[group] ?? {}) as Record<string, unknown>;
      target[sub] = coerced;
      raw[group] = target;
    }
  }
  return { patch: CarportPatchSchema.parse(raw), message: wire.message };
}

export interface Change {
  path: string;
  label: string;
  from: unknown;
  to: unknown;
}

const NESTED = ["overhangFt", "posts", "framing", "colors", "ground"] as const;

const LABELS: Record<string, string> = {
  name: "Name",
  type: "Roof type",
  widthFt: "Width",
  depthFt: "Depth",
  plateHeightFt: "Plate height",
  roofPitch: "Roof pitch",
  rotationDeg: "Rotation",
  position: "Position",
  roofing: "Roofing",
  gableTruss: "Gable truss",
  "overhangFt.eave": "Eave overhang",
  "overhangFt.rake": "Rake overhang",
  "posts.size": "Post size",
  "posts.countAlongWidth": "Post rows",
  "posts.countAlongDepth": "Posts per row",
  "posts.material": "Post material",
  "posts.base": "Post base",
  "framing.beamSize": "Beam",
  "framing.beamPly": "Beam plies",
  "framing.rafterSize": "Rafter",
  "framing.rafterSpacingIn": "Rafter spacing",
  "colors.post": "Post color",
  "colors.trim": "Trim color",
  "colors.roof": "Roof color",
  "ground.dropFt": "Ground drop",
  "ground.towardDeg": "Downhill direction",
};

const UNITS: Record<string, string> = {
  widthFt: " ft",
  depthFt: " ft",
  plateHeightFt: " ft",
  roofPitch: ":12",
  rotationDeg: "°",
  "overhangFt.eave": " ft",
  "overhangFt.rake": " ft",
  "framing.rafterSpacingIn": '"',
  "ground.dropFt": " ft",
  "ground.towardDeg": "°",
};

export function formatValue(path: string, v: unknown): string {
  if (Array.isArray(v)) return `(${v.map((n) => (typeof n === "number" ? n.toFixed(1) : String(n))).join(", ")})`;
  if (typeof v === "boolean") return v ? "on" : "off";
  return `${String(v)}${UNITS[path] ?? ""}`;
}

export type ApplyResult = { ok: true; carport: Carport; changes: Change[] } | { ok: false; reason: string };

/** Merge a validated patch into a carport, re-validate the whole thing, and describe what changed. */
export function applyPatch(carport: Carport, patch: CarportPatch): ApplyResult {
  const next: Carport = structuredClone(carport);
  const changes: Change[] = [];
  const record = (path: string, from: unknown, to: unknown) => {
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ path, label: LABELS[path] ?? path, from, to });
  };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if ((NESTED as readonly string[]).includes(key)) {
      const target = next[key as (typeof NESTED)[number]] as Record<string, unknown>;
      for (const [sub, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined) continue;
        record(`${key}.${sub}`, target[sub], v);
        target[sub] = v;
      }
    } else if (key === "position") {
      const p = value as { x?: number; y?: number };
      const moved: [number, number] = [p.x ?? next.position[0], p.y ?? next.position[1]];
      record("position", next.position, moved);
      next.position = moved;
    } else {
      record(key, (next as unknown as Record<string, unknown>)[key], value);
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  }

  const result = CarportSchema.safeParse(next);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, reason: first ? `${first.path.join(".")}: ${first.message}` : "invalid carport" };
  }
  return { ok: true, carport: result.data, changes };
}

/** Compact description of the current carport for the model. Numbers only, no images. */
export function describeCarport(c: Carport): Record<string, unknown> {
  return {
    name: c.name,
    type: c.type,
    widthFt: c.widthFt,
    depthFt: c.depthFt,
    plateHeightFt: c.plateHeightFt,
    roofPitch: c.roofPitch,
    rotationDeg: c.rotationDeg,
    position: { x: c.position[0], y: c.position[1] },
    overhangFt: c.overhangFt,
    posts: c.posts,
    framing: c.framing,
    roofing: c.roofing,
    colors: c.colors,
    gableTruss: c.gableTruss,
    ground: c.ground,
  };
}
