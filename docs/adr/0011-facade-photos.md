# 0011. Facade photos: store the corners, rectify at load

Date: 2026-09-19. Status: accepted.

## Context

Phase 4 puts a photo of a real wall onto the matching wall of a massing block. The photo is taken from wherever the user could stand, so the wall is a perspective quad in the image.

## Decision

- The project stores the original photo blob and the four corner points the user clicked, per wall index (`Mass.facade`). Nothing derived is persisted.
- At load, a square-to-quad homography rectifies the marked quad into an upright texture sized to the wall's aspect. The warp is a CPU loop over at most 1024 px wide output with bilinear sampling, cached per photo, corners and wall size.
- Blocks render one quad per wall so a texture maps to exactly one wall. `wallFrame` orders each wall left-to-right for a viewer outside, independent of trace direction, so photo left equals wall left.
- Facade blobs count as referenced for the orphan sweep and travel in the project file.

## Consequences

Re-clicking corners or resizing the block re-rectifies without touching the stored photo. The texture is a flat picture, so windows and brick read right from the front and smear at grazing angles, which is acceptable for a concept.
