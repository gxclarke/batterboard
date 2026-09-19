# 0010. Ground slope under a structure

Date: 2026-09-19. Status: accepted.

## Context

The owner's carport site falls toward a pond past the end of the slab. Posts landing off the pad need longer legs and pier footings. The site model is a flat plane (the aerial), and a true terrain model is out of scope for v1.

## Decision

- A structure carries `ground: { dropFt, towardDeg }`: the ground falls `dropFt` across its footprint in the downhill direction `towardDeg` (site angle).
- The lowest corner sits on the aerial plane. Higher ground is drawn as a graded pad wedge above the plane, and posts run from that ground to the level beam. Beams and roof stay level.
- Blocks keep their own `baseElevation`; the user raises a house block to match if the carport's high side meets it.

## Consequences

Two numbers express the common case honestly and the 3D view shows the longer legs on the low side. It is not terrain: two structures on different slopes do not share a surface, and the aerial itself stays flat. If real terrain is ever needed, `groundAt` in the carport layout is the single seam to replace.
