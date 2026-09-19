# 0008. Aerial as tiles, cropped at import, aligned by one point

Date: 2026-09-19. Status: accepted.

## Context

At a zoom where roofs can be traced, one phone screenshot does not cover a lot. Screenshots also carry status bars, search boxes and map labels. The plan modeled a single aerial image.

## Decision

- `site.tiles` is a list. Each tile has its own blob and an `offsetPx` in one shared pixel frame. The first tile sits at the origin; later tiles may have negative offsets.
- Screenshots must be north-up and at the same zoom. Registration is therefore a pure translation: the user clicks the same feature in the existing composite and in the new tile.
- Chrome is cropped at import by drawing the selected region to a canvas and storing the JPEG. The original file is not kept.
- Scale (`pxPerFoot`) is one number for the whole frame. Site feet are frame pixels divided by it.

## Consequences

Calibration happens once, on any tile. Tracing works across tile seams. A zoom mismatch between screenshots shows up as a visible misfit at the seam and is the user's cue to recapture. Rotation and scale between tiles are out of scope; if needed later, the offset becomes a similarity transform without changing the frame concept.
