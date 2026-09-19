# 0009. Reality checks are advisory approximations

Date: 2026-09-19. Status: accepted.

## Context

The plan asks for warnings when spans, spacing, heights, setbacks or overlaps are implausible, presented as amber advisories with plain-language explanations, never hard blocks. Authoritative span tables depend on species, grade, snow load, and jurisdiction, none of which a homeowner sketching a concept knows.

## Decision

- `src/checks/spans.ts` holds approximations: rafter spans near IRC R802.4.1 for #2 Douglas fir-larch at 20 psf live / 10 psf dead, and beam spans from the IRC R507.5 deck girder table scaled by 1.25 for a lighter roof and interpolated on tributary width. Solid 4x, 6x and LVL beams are scaled from the built-up rows by section width.
- `src/checks/rules.ts` is pure: `runChecks(project)` returns `Warning[]` with a severity of `warn` or `info`, a title in the user's terms, and a detail that says what to change.
- Checks: rafter span, beam span between posts, 4x4 posts, tall 6x6 posts, plate height too low or high, roof overlap or roof clash with a block, tight gap to a block, roof outside the lot line, roof inside a setback (using the smallest of front, rear, side until edges are classified).
- Every panel that shows warnings shows the disclaimer on demand: concept tool, not code, confirm with a builder.

## Consequences

The numbers are directionally right and conservative, which is what "a builder wouldn't laugh at" needs. They are not a substitute for a table lookup by a professional, and the UI says so. Setback classification by lot edge (front vs side) is deferred until the lot tool can mark the street side.
