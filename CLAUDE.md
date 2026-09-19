# Batterboard

Browser-only tool for rough 3D concepts of small structures (carport first) on a homeowner's real site. Read `docs/plan.md` fully, then `docs/adr/` for the decisions that amend it.

## Rules that matter most

- All geometry is deterministic TypeScript. Generators are pure: `(params) => THREE.Group`, no store access. The LLM only ever emits schema-validated parameter patches.
- `src/schema/project.ts` is the single source of truth. Infer types from zod; never hand-write duplicate interfaces. Every number has a range.
- Site space to Three.js conversion happens only in `src/geometry/frame.ts`.
- Real lumber dimensions from `src/geometry/lumber.ts`. A 6x6 is 5.5 inches.
- No backend beyond the one Cloudflare Worker (Phase 3). No accounts, no server storage.
- Decisions that are not obvious from the code go in `docs/adr/`.

## Commands

```
pnpm dev        # Vite dev server
pnpm test       # Vitest
pnpm typecheck  # tsc --noEmit
pnpm lint       # Biome check (lint:fix to write)
pnpm spell      # cspell
pnpm build      # typecheck + vite build
```

Pre-commit runs Biome and cspell on staged files via lefthook.

## Layout

See §6 of the plan. Structures live under `src/geometry/structures/<kind>.ts` with a registry in `index.ts` (ADR 0002).
