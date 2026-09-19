import { describe, expect, it } from "vitest";
import { defaultCarport } from "@/schema/defaults";
import {
  AssistantReplySchema,
  AssistantReplyWireSchema,
  applyPatch,
  CarportPatchSchema,
  fromWire,
  PATCH_FIELDS,
} from "./patch";

describe("CarportPatchSchema", () => {
  it("accepts partial nested patches and rejects unknown keys and out-of-range values", () => {
    expect(CarportPatchSchema.safeParse({ depthFt: 24, framing: { rafterSpacingIn: 16 } }).success).toBe(true);
    expect(CarportPatchSchema.safeParse({}).success).toBe(true);
    expect(CarportPatchSchema.safeParse({ id: "x" }).success).toBe(false);
    expect(CarportPatchSchema.safeParse({ plateHeightFt: 400 }).success).toBe(false);
    expect(CarportPatchSchema.safeParse({ posts: { size: "12x12" } }).success).toBe(false);
  });
  it("parses an assistant reply with or without a patch", () => {
    expect(AssistantReplySchema.safeParse({ patch: null, message: "How long are your cars?" }).success).toBe(true);
    expect(AssistantReplySchema.safeParse({ patch: { depthFt: 24 }, message: "Deepened to 24 ft." }).success).toBe(
      true,
    );
  });
});

describe("fromWire", () => {
  it("builds a sparse nested patch from field paths, coercing text by field type", () => {
    const wire = AssistantReplyWireSchema.parse({
      changes: [
        { field: "depthFt", value: "24" },
        { field: "framing.rafterSpacingIn", value: "16" },
        { field: "colors.roof", value: "#2f4f3f" },
        { field: "gableTruss", value: "true" },
        { field: "type", value: "hip" },
        { field: "name", value: "42" },
        { field: "position.x", value: "-12.5" },
      ],
      message: "ok",
    });
    expect(fromWire(wire)).toEqual({
      patch: {
        depthFt: 24,
        framing: { rafterSpacingIn: 16 },
        colors: { roof: "#2f4f3f" },
        gableTruss: true,
        type: "hip",
        name: "42",
        position: { x: -12.5 },
      },
      message: "ok",
    });
  });
  it("turns no changes into no patch", () => {
    expect(fromWire({ changes: [], message: "nothing to do" }).patch).toBeNull();
  });
  it("rejects unknown fields and values that do not fit", () => {
    expect(AssistantReplyWireSchema.safeParse({ changes: [{ field: "id", value: "x" }], message: "" }).success).toBe(
      false,
    );
    expect(() => fromWire({ changes: [{ field: "widthFt", value: "wide" }], message: "" })).toThrow();
    expect(() => fromWire({ changes: [{ field: "posts.size", value: "12x12" }], message: "" })).toThrow();
  });
  it("lists every leaf path once", () => {
    expect(PATCH_FIELDS).toContain("framing.rafterSpacingIn");
    expect(PATCH_FIELDS).toContain("position.y");
    expect(new Set(PATCH_FIELDS).size).toBe(PATCH_FIELDS.length);
  });
});

describe("applyPatch", () => {
  it("merges and describes changes", () => {
    const r = applyPatch(defaultCarport(), { depthFt: 24, framing: { rafterSpacingIn: 16 }, gableTruss: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.carport.depthFt).toBe(24);
    expect(r.carport.framing.rafterSpacingIn).toBe(16);
    expect(r.carport.framing.beamSize).toBe("2x10"); // untouched sibling survives
    expect(r.changes.map((c) => c.label)).toEqual(["Depth", "Rafter spacing", "Gable truss"]);
    expect(r.changes[0]).toMatchObject({ from: 20, to: 24 });
  });
  it("maps a position object back onto the tuple, keeping the untouched axis", () => {
    const r = applyPatch(defaultCarport(), { position: { x: 12, y: 34 } });
    expect(r.ok && r.carport.position).toEqual([12, 34]);
    expect(r.ok && r.changes[0]?.label).toBe("Position");
    const half = applyPatch(defaultCarport({ position: [5, 6] }), { position: { y: 40 } });
    expect(half.ok && half.carport.position).toEqual([5, 40]);
  });
  it("ignores no-op values", () => {
    const r = applyPatch(defaultCarport(), { widthFt: 20 });
    expect(r.ok && r.changes).toEqual([]);
  });
  it("refuses a merge that breaks the carport's own ranges", () => {
    // the patch schema allows 8..40 ft, but the check still runs on the merged object
    const r = applyPatch(defaultCarport(), { widthFt: 40 } as never);
    expect(r.ok).toBe(true);
    const bad = applyPatch(defaultCarport(), { widthFt: 2 } as never);
    expect(bad.ok).toBe(false);
  });
});
