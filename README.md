# Batterboard

Rough 3D concepts of small structures on your own property, in the browser, in about ten minutes. Trace your house from a satellite screenshot, drop in a parametric carport, check the afternoon shade, hand a builder a screenshot and a GLB.

A batterboard is the string-and-stake layout a builder sets before anything is poured. This tool is that stage, not the drawings.

## What it does

- **Site from a screenshot.** Paste a north-up satellite screenshot, crop the phone chrome, calibrate scale from something you know the size of, add more screenshots at the same zoom and line them up by one shared point.
- **Trace the site.** Rectangles for house blocks (they keep their right angles), polygons for driveways and the lot line. Drag shapes and corners to fix them.
- **Blocks become massing.** Gable, hip, shed or flat roofs on rectangular blocks. A photo of a wall, four clicks on its corners, and the block wears it.
- **A parametric carport** with real lumber sizes, real post and rafter layout, knee braces, an optional exposed gable truss, and a ground slope for sites that fall away.
- **Real sun.** Set the location, scrub the time and date, read the shadows in plan or perspective.
- **Reality check.** Amber advisories from simplified span tables and rules of thumb: rafter and beam spans, post size, headroom, roof clash with the house, lot line and setbacks. Never a code claim.
- **Export.** PNG screenshot, binary glTF of the scene, and a single project file with images that reopens anywhere.

Everything runs in the browser. Projects live in IndexedDB. There is no account and no server, apart from a single Cloudflare Worker for the optional natural-language panel.

## Develop

```
pnpm install
pnpm dev        # Vite dev server
pnpm test       # Vitest
pnpm typecheck  # tsc --noEmit
pnpm lint       # Biome (lint:fix to write)
pnpm spell      # cspell
pnpm build      # typecheck + vite build
```

Pre-commit runs Biome and cspell on staged files via lefthook.

## Deploy

Both halves run on Cloudflare Workers. The site is a Worker serving `dist/` as static assets (root `wrangler.jsonc`); the assistant is the Worker in `worker/` (see its README for the API key step).

```
VITE_LLM_ENDPOINT=https://batterboard-llm.batterboard-worker.workers.dev pnpm build
pnpm run deploy:site
pnpm run deploy:worker
```

Leave `VITE_LLM_ENDPOINT` unset to ship without the assistant panel.

## Where to read

- `docs/plan.md` is the working spec.
- `docs/adr/` records every decision that amends it.
- `CLAUDE.md` is the short version for a coding agent.

## License

MIT.
