# 0004. Coordinate and angle conventions

Date: 2026-09-18. Status: accepted.

## Context

Site space follows the aerial image: +x right, +y down. The plan says to map site y to Three.js −z. Viewed from above, Three.js shows +x as screen-right and +z as screen-down, so that mapping mirrors the plan. The plan also defines `northOffsetDeg` as "rotation of image +y from true north," which makes a north-up screenshot 180°.

## Decision

- Site (x, y) maps to Three.js (x, elevation, y). No mirroring. The conversion lives only in `src/geometry/frame.ts`.
- Site angles are measured from +x toward +y, which is clockwise on screen. A site angle θ is Three.js `rotation.y = −θ`.
- `northOffsetDeg` is the clockwise bearing of image-up from true north. 0 means a north-up screenshot.
- `Project.view` camera vectors are in Three.js coordinates.

## Consequences

Traced polygons render with the same handedness they were drawn. Sun azimuth from suncalc (clockwise from north) converts to a site angle by adding `northOffsetDeg` and subtracting 90°.
