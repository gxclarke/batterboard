# 0003. Carport framing convention

Date: 2026-09-18. Status: accepted.

## Context

The plan's `Carport` fields (`countAlongWidth`, `countAlongDepth`, "posts at the perimeter", "beams spanning between post rows") admit two different framing layouts. The generator and the span checks need one.

## Decision

- Vehicles enter along `depthFt`. Post rows run along depth. There are never posts across the open ends.
- `posts.countAlongWidth` is the number of rows (2 is a clear span, the default double carport). `posts.countAlongDepth` is posts per row.
- One beam per row, running along depth, ends flush with the outer post faces. Beam thickness is `beamPly` times the actual ply thickness.
- Rafters span the width in every roof type. Gable and hip ridges run along depth.
- A shed roof slopes across the width, high side at local −x. `plateHeightFt` is the low-side bearing height. Orientation on site comes from `rotationDeg`.
- `widthFt` × `depthFt` is the out-to-out footprint of the posts. The roof extends past it by `overhangFt.eave` on the sides and `overhangFt.rake` on the ends. Hip roofs use `eave` all around.
- `plateHeightFt` is measured at the outer post-row centerline. Interior rows (and the high shed row) are as tall as the roof plane requires.
- Hip roofs have equal pitch on all faces. If the footprint is wider than deep, the hip ridge runs across the width instead.
- Knee braces sit on the four corner posts in the plane of the beam, 45°, 2.5 ft legs, 4x4.

## Consequences

Beam span for checks is the post spacing within a row. Rafter span is the horizontal run from bearing to ridge (gable, hip) or across the full width (shed). A center row (`countAlongWidth` 3) is taller and carries the ridge, which falls out of the geometry with no special case.
