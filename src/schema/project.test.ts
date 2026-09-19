import { describe, expect, it } from "vitest";
import { defaultCarport, defaultProject } from "./defaults";
import { CarportSchema, migrate, ProjectSchema } from "./project";

describe("schema", () => {
  it("accepts the defaults", () => {
    expect(ProjectSchema.safeParse(defaultProject()).success).toBe(true);
    expect(CarportSchema.safeParse(defaultCarport()).success).toBe(true);
  });

  it("clamps the physical world", () => {
    expect(CarportSchema.safeParse(defaultCarport({ plateHeightFt: 400 })).success).toBe(false);
    expect(CarportSchema.safeParse(defaultCarport({ widthFt: 2 })).success).toBe(false);
    expect(CarportSchema.safeParse(defaultCarport({ roofPitch: -1 })).success).toBe(false);
    const p = defaultCarport();
    expect(CarportSchema.safeParse({ ...p, posts: { ...p.posts, countAlongWidth: 1 } }).success).toBe(false);
    expect(CarportSchema.safeParse({ ...p, framing: { ...p.framing, rafterSpacingIn: 19 } }).success).toBe(false);
    expect(CarportSchema.safeParse({ ...p, colors: { ...p.colors, roof: "red" } }).success).toBe(false);
  });

  it("rejects unknown structure kinds", () => {
    const p = defaultProject();
    const bad = { ...p, structures: [{ ...defaultCarport(), kind: "gazebo" }] };
    expect(ProjectSchema.safeParse(bad).success).toBe(false);
  });

  it("migrate is a validating no-op for v1 and refuses the future", () => {
    const p = defaultProject();
    expect(migrate(structuredClone(p))).toEqual(p);
    expect(() => migrate({ ...p, schemaVersion: 2 })).toThrow(/newer/);
    expect(() => migrate({})).toThrow(/schemaVersion/);
  });
});
