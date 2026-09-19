import { describe, expect, it } from "vitest";
import { defaultCarport, defaultMass, defaultProject } from "@/schema/defaults";
import type { Carport, Project } from "@/schema/project";
import { runChecks } from "./rules";

function projectWith(carport: Partial<Carport>, extra: Partial<Project> = {}): Project {
  const p = defaultProject();
  p.structures = [defaultCarport(carport)];
  return { ...p, ...extra };
}
const ids = (p: Project) => runChecks(p).map((w) => w.id.split(":")[1]);

describe("reality checks", () => {
  it("the default double carport is clean", () => {
    expect(runChecks(projectWith({}))).toEqual([]);
  });

  it("flags rafters spanning too far", () => {
    // 30 ft wide shed roof on 2x8 @ 24: ~29.5 ft span vs ~13.9
    expect(ids(projectWith({ type: "shed", widthFt: 30 }))).toContain("rafter-span");
    // same width as a gable halves the span, but 15 ft still beats 13.9
    expect(ids(projectWith({ widthFt: 30 }))).toContain("rafter-span");
    expect(
      ids(projectWith({ widthFt: 24, framing: { ...defaultCarport().framing, rafterSpacingIn: 16 } })),
    ).not.toContain("rafter-span");
  });

  it("flags posts too far apart for the beam", () => {
    // 2 posts per row on a 30 ft deep carport: ~29 ft clear span
    const p = projectWith({ depthFt: 30, posts: { ...defaultCarport().posts, countAlongDepth: 2 } });
    expect(ids(p)).toContain("beam-span");
    const ok = projectWith({ depthFt: 30, posts: { ...defaultCarport().posts, countAlongDepth: 4 } });
    expect(ids(ok)).not.toContain("beam-span");
  });

  it("flags 4x4 posts and low plates", () => {
    expect(ids(projectWith({ posts: { ...defaultCarport().posts, size: "4x4" } }))).toContain("post-size");
    expect(ids(projectWith({ plateHeightFt: 7 }))).toContain("plate-low");
    expect(ids(projectWith({ plateHeightFt: 13 }))).toContain("plate-high");
  });

  it("flags overlap and proximity with a block", () => {
    const house = defaultMass(
      [
        [0, 0],
        [40, 0],
        [40, 24],
        [0, 24],
      ],
      "House",
    );
    // carport centered 5 ft from the house's south wall: roof (with 1 ft eave) overlaps
    const overlapping = projectWith({ position: [20, 34] }, { masses: [house] });
    const w = runChecks(overlapping).find((x) => x.id.endsWith(`mass-${house.id}`));
    expect(w?.severity).toBe("warn");
    expect(w?.title).toMatch(/runs into|overlaps/);
    // 12 ft away: roof edge 1 ft from the wall -> info about the tight gap
    const tight = projectWith({ position: [20, 36] }, { masses: [house] });
    expect(runChecks(tight).find((x) => x.id.endsWith(`mass-${house.id}`))?.severity).toBe("info");
    // 20 ft away: nothing
    const clear = projectWith({ position: [20, 60] }, { masses: [house] });
    expect(runChecks(clear).find((x) => x.id.endsWith(`mass-${house.id}`))).toBeUndefined();
  });

  it("flags lot line and setback problems", () => {
    const lot: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const base = defaultProject();
    const site = { ...base.site, lot: { boundary: lot, setbacks: { front: 25, rear: 10, side: 5 } } };
    expect(ids(projectWith({ position: [5, 50] }, { site }))).toContain("lot-outside");
    expect(ids(projectWith({ position: [14, 50] }, { site }))).toContain("setback"); // roof edge at x=3
    expect(ids(projectWith({ position: [50, 50] }, { site }))).not.toContain("setback");
  });
});
