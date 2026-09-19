import { describe, expect, it } from "vitest";
import { bearingToDir, dateFor, formatHour, sunState } from "./sunModel";

describe("bearingToDir", () => {
  it("south is +z (image down) on a north-up image", () => {
    const [x, y, z] = bearingToDir(180, 0);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(1);
  });
  it("east is +x on a north-up image", () => {
    const [x, , z] = bearingToDir(90, 0);
    expect(x).toBeCloseTo(1);
    expect(z).toBeCloseTo(0);
  });
  it("respects the image's north offset", () => {
    // image-up points east, so south is image-right (+x)
    const [x, , z] = bearingToDir(180, 90);
    expect(x).toBeCloseTo(1);
    expect(z).toBeCloseTo(0);
  });
  it("altitude lifts the vector", () => {
    const [, y] = bearingToDir(180, 0, 30);
    expect(y).toBeCloseTo(0.5);
  });
});

describe("sunState", () => {
  it("midday in Texas in June: high in the south-ish sky", () => {
    // 13:30 local CDT = 18:30 UTC; near solar noon at 97 W
    const date = new Date(Date.UTC(2026, 5, 21, 18, 30));
    const s = sunState({ lat: 33, lon: -97, northOffsetDeg: 0, date });
    expect(s.up).toBe(true);
    expect(s.altitudeDeg).toBeGreaterThan(75);
    expect(Math.abs(s.bearingDeg - 180)).toBeLessThan(25);
    expect(s.dir[2]).toBeGreaterThan(0); // toward image-down (south)
  });
  it("afternoon sun is in the west", () => {
    const date = new Date(Date.UTC(2026, 8, 19, 22, 0)); // 17:00 CDT
    const s = sunState({ lat: 33, lon: -97, northOffsetDeg: 0, date });
    expect(s.bearingDeg).toBeGreaterThan(240);
    expect(s.bearingDeg).toBeLessThan(290);
    expect(s.dir[0]).toBeLessThan(0); // west is image-left
  });
  it("midnight is below the horizon", () => {
    const date = new Date(Date.UTC(2026, 8, 19, 6, 0)); // 01:00 CDT
    expect(sunState({ lat: 33, lon: -97, northOffsetDeg: 0, date }).up).toBe(false);
  });
});

describe("helpers", () => {
  it("builds a local date from parts", () => {
    const d = dateFor(9, 19, 15.5, 2026);
    expect(d.getMonth()).toBe(8);
    expect(d.getDate()).toBe(19);
    expect(d.getHours()).toBe(15);
    expect(d.getMinutes()).toBe(30);
  });
  it("formats hours", () => {
    expect(formatHour(15.25)).toBe("3:15 PM");
    expect(formatHour(0)).toBe("12:00 AM");
    expect(formatHour(12)).toBe("12:00 PM");
  });
});
