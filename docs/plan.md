# Carport Studio — Build Plan

**Status:** spec for initial build
**Audience:** Claude Code (this is the working spec; read it fully before writing code)

---

## Amendments

Decisions made while building that change or sharpen this plan. Each links to an ADR in `docs/adr/`.

- The product is **Batterboard**. The carport is the first structure kind, not the product. Projects hold `structures: Structure[]` (ADR 0002).
- Carport framing convention: post rows along depth, beams along rows, rafters span width; shed roof slopes across width (ADR 0003).
- Site y maps to Three.js +z, and `northOffsetDeg` is the bearing of image-up (ADR 0004).
- The aerial is a list of same-zoom screenshot tiles in one pixel frame, cropped at import and aligned by one shared point (ADR 0008).
- Reality checks use approximate span tables and are advisory only (ADR 0009).
- One project, tracing gated on small screens (ADR 0005). React 19 because r3f 9 requires it (ADR 0006). LLM is Claude Opus (ADR 0007).

---

## 1. What this is

A free web app that lets a homeowner produce a **credible 3D concept** of a freestanding carport on their own property, in about ten minutes, with no CAD experience.

The output is an orbitable 3D scene: their house as massing, their real driveway and lot underneath, and a parametric carport that is dimensionally sane and structurally plausible.

### The bar

> Communicates the vision effectively while being grounded in reality.

"Grounded in reality" means:
- Real site geometry, at real scale, from their own aerial image
- Real sun angles for their latitude and time of year
- Member sizes and spans that a builder wouldn't laugh at
- Setback awareness if they trace their lot lines

It does **not** mean permit-ready, cut-list-accurate, or engineer-checked.

### Explicit non-goals for v1

- No permit drawings, no stamped plans, no code compliance claims
- No photogrammetry, no point clouds, no dense reconstruction
- No user accounts, no server-side project storage
- No attached structures (ledger-to-house is a different structural problem) — freestanding only
- No garages, sheds, or enclosed structures — open carports only
- No cost estimation (too regional, too volatile, too easy to get sued over)

---

## 2. The central architectural decision

**All geometry is deterministic TypeScript running in the browser. The LLM only ever emits validated parameters.**

The failure mode of every existing attempt at this problem is asking a model to produce geometry. It can't. So:

```
user speech  →  LLM  →  JSON patch (zod-validated)  →  deterministic generator  →  Three.js scene
```

The LLM never writes code, never emits meshes, never estimates a distance from an image. It maps natural language onto a constrained parameter space. If the LLM is unavailable, rate-limited, or wrong, the parameter panel still drives the entire app. **The LLM is an accelerator, not a dependency.**

This is also what makes the economics work (see §8).

---

## 3. Why no reconstruction

Worth stating so it doesn't get relitigated mid-build:

1. **Cost.** Dense reconstruction needs a GPU. At ad-supported revenue per session, one GPU-second per user is already underwater. Client-side tracing costs zero.
2. **Access.** iOS Safari has no ARKit depth API. WebXR doesn't expose LiDAR. A web app cannot reach the scanner in the user's phone, regardless of whether they own one.
3. **Sufficiency.** For concept communication, a gray massing box of the house with the correct footprint, height, and roof shape reads about as well as a photogrammetric mesh — and it looks intentional rather than melted.

Scan import exists as an optional path (§7, Phase 6) for users who already have a Polycam/Scaniverse export. It is never required and never on the critical path.

---

## 4. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Build | Vite + TypeScript | Fast, boring, zero config drift |
| UI | React 18 | Ecosystem |
| 3D | Three.js via react-three-fiber + drei | Orbit controls, shadows, GLTF export all solved |
| Validation | zod | Single source of truth for the schema; LLM output validation |
| State | Zustand | Simple, no boilerplate, easy undo stack |
| 2D tracing | HTML Canvas 2D (not a lib) | Polygon tracing is ~200 lines; a lib is more work than the feature |
| Persistence | IndexedDB via `idb` | Aerial images are megabytes; localStorage will blow its quota |
| Hosting | Cloudflare Pages | Static, free tier, global |
| LLM proxy | One Cloudflare Worker | The only server-side code in the project |
| Sun position | `suncalc` | Tiny, correct, well-tested |

**Hard constraint: no backend beyond the single Worker.** No database, no object storage, no auth. Projects live in the user's browser. Sharing works by export/import of a `.carport.json` file.

---

## 5. Data model

This is the contract. Everything else is downstream of it. Define it once in `src/schema/project.ts` as zod schemas, infer TypeScript types from them, and never hand-write a duplicate interface.

All linear units are **feet** (decimal). All angles are **degrees**. Roof pitch is **rise per 12**. Site coordinates are a **right-handed 2D plane in feet**, origin at the aerial image's top-left corner at time of calibration, `+x` right, `+y` down in image space (convert to Three.js `x/-z` at render time in exactly one place).

```ts
Project {
  schemaVersion: 1
  id: string
  name: string
  createdAt / updatedAt: ISO string

  site: {
    aerial: {
      blobKey: string        // IndexedDB key, never inline base64 in the JSON
      widthPx / heightPx: number
    }
    scale: {
      pxPerFoot: number
      calibration: {
        p1 / p2: [number, number]   // pixel coords
        knownFeet: number
        label: string               // "garage door", "driveway width"
      }
    }
    northOffsetDeg: number     // rotation of image +y from true north
    location: { lat: number, lon: number } | null   // null → sun disabled
    lot: {
      boundary: Point[] | null
      setbacks: { front: number, rear: number, side: number } | null
    }
  }

  masses: Mass[]        // house, existing garage, shed, trees-as-cylinders
  surfaces: Surface[]   // driveway, walkway, lawn — flat textured polygons
  structure: Carport    // the thing being designed. Exactly one in v1.

  view: { cameraPosition: Vec3, cameraTarget: Vec3 }
  notes: string
}

Mass {
  id / name: string
  footprint: Point[]          // feet, closed polygon, min 3 points
  baseElevation: number       // feet above site datum, usually 0
  wallHeight: number          // feet to eave
  roof: {
    type: 'gable' | 'hip' | 'shed' | 'flat'
    pitch: number             // rise per 12
    ridgeAxisDeg: number      // ignored for hip/flat
  }
  facade: { wallIndex: number, blobKey: string, corners: Point[] }[] | null
  color: string
}

Surface {
  id / name: string
  polygon: Point[]
  material: 'concrete' | 'asphalt' | 'gravel' | 'grass' | 'pavers'
}

Carport {
  type: 'gable' | 'shed' | 'hip'
  position: Point             // center of footprint, site feet
  rotationDeg: number

  widthFt: number             // gable: perpendicular to ridge
  depthFt: number
  plateHeightFt: number       // grade to beam bearing
  roofPitch: number
  overhangFt: { eave: number, rake: number }

  posts: {
    size: '4x4' | '6x6' | '8x8'
    countAlongWidth: number   // >= 2
    countAlongDepth: number   // >= 2
    material: 'pt-lumber' | 'cedar' | 'steel'
    base: 'surface-mount' | 'embedded' | 'pier'
  }

  framing: {
    beamSize: '2x8' | '2x10' | '2x12' | '4x10' | '6x10' | 'lvl'
    beamPly: number
    rafterSize: '2x6' | '2x8' | '2x10' | '2x12'
    rafterSpacingIn: 16 | 24
  }

  roofing: 'standing-seam' | 'corrugated-metal' | 'asphalt-shingle' | 'polycarbonate'
  colors: { post: string, trim: string, roof: string }
}
```

### Schema notes for the implementer

- `blobKey` never contains image data. Images go in IndexedDB under their own store. Export bundles them as a zip or inlines base64 only at export time.
- `schemaVersion` is present from day one. Write a `migrate(project)` function immediately, even if it's a no-op, so v2 doesn't break saved projects.
- Every numeric field gets a zod `.min()` / `.max()` with a physically sensible range. This is the guardrail that stops the LLM from producing a 400-foot-tall carport.

---

## 6. Module breakdown

```
src/
  schema/
    project.ts          zod schemas + inferred types + migrate()
    defaults.ts         sensible starting Carport, Mass, Project
  store/
    useProject.ts       zustand store, undo/redo stack, autosave to IndexedDB
    persistence.ts      IndexedDB read/write, blob store
  calibrate/
    Calibrator.tsx      upload aerial, drag a line, pick known dimension
    knownDimensions.ts  standard sizes: garage doors 8/9/16/18ft, etc.
  trace/
    TraceCanvas.tsx     2D polygon tracing over the aerial
    polygon.ts          point-in-poly, area, simplify, self-intersection check
  geometry/
    carport.ts          Carport -> THREE.Group. THE core file.
    mass.ts             Mass -> THREE.Group (walls + roof solid)
    roof.ts             gable/hip/shed/flat roof surface generation
    surface.ts          Surface -> textured plane
    lumber.ts           nominal -> actual dims (2x8 = 1.5 x 7.25)
  scene/
    Viewport.tsx        r3f canvas, orbit controls, ground grid
    Sun.tsx             suncalc -> directional light + shadow config
    Materials.tsx       shared material definitions
  checks/
    spans.ts            span tables
    rules.ts            run all checks -> Warning[]
    WarningPanel.tsx
  llm/
    worker-client.ts    fetch wrapper to the Worker
    patch.ts            apply validated partial Carport to store
  panels/
    StructurePanel.tsx  the manual parameter UI
    ChatPanel.tsx       natural language input
  export/
    glb.ts / png.ts / projectFile.ts
worker/
  index.ts              Cloudflare Worker: LLM proxy, rate limit, schema enforce
```

### `geometry/carport.ts` — the heart of it

This is the file to get right. It must be a **pure function**: `(carport: Carport) => THREE.Group`. No store access, no side effects, no async. That makes it trivially testable and means the LLM path and the panel path are guaranteed to produce identical results.

Build order inside it:
1. Post grid from `countAlongWidth/Depth`, `widthFt`, `depthFt` — posts at the perimeter positions, evenly spaced
2. Beams spanning between post rows
3. Rafters perpendicular to beams at `rafterSpacingIn`
4. Roof planes per `type` and `pitch`, extended by `overhangFt`
5. Roofing surface with the right material
6. Knee braces on corner posts (freestanding needs lateral resistance; showing braces is part of looking credible)

Use real lumber dimensions from `lumber.ts`. A 6x6 is 5.5", not 6". This detail is most of what separates "looks like a real structure" from "looks like a toy."

---

## 7. Build phases

Each phase is independently useful. Ship-and-evaluate between them.

### Phase 0 — Site model (no AI, no carport)
Upload an aerial image. Calibrate scale by dragging a line across a known dimension and picking its length from a dropdown. Trace the house footprint. Set wall height and roof type. Trace the driveway. See it extruded in 3D and orbit it.

**Acceptance:** you can recognize your own house from the 3D view.

This phase alone is the hardest to get right and the most load-bearing. Do not rush it.

### Phase 1 — Parametric carport
Place a carport, position and rotate it on the site, drive every parameter from a panel. Real lumber sizes, real framing, shadows from `suncalc` with a time-of-day and time-of-year scrubber.

**Acceptance:** your actual carport concept, viewable, with correct afternoon shade on the driveway.

At this point the project has already solved your personal problem. Everything after is for other people.

### Phase 2 — Reality checks
`checks/spans.ts` with span tables for the common cases. Warn on: beam span too long for size and spacing, rafter span too long, post spacing excessive for beam size, plate height unusual, footprint crossing a setback line, footprint overlapping an existing mass.

Present as amber advisories with plain-language explanations, never as hard blocks. Include a clear disclaimer that this is a concept tool.

### Phase 3 — Natural language
Chat panel. `"make it deeper so two cars fit"`, `"lower the roof"`, `"switch to a shed roof sloping away from the house"`. Worker returns a partial `Carport`, zod validates it, store applies it as a single undoable patch. Show the user what changed.

Small model. Aggressive caching. Hard per-session cap. Panel remains fully functional without it.

### Phase 4 — Facade textures
Upload a photo of the house wall, click its four corners in the photo, click the corresponding wall in the 3D view, apply as a homography-warped texture. Large realism gain for modest effort, entirely client-side.

### Phase 5 — Export and share
GLB download, PNG screenshot at a chosen camera angle, `.carport.json` project file with embedded images. No server, no links, no accounts.

### Phase 6 — Optional scan import
Accept `.glb` / `.obj` / `.ply` from Polycam or Scaniverse. Let the user align it to the ground plane and scale it against a known dimension. Renders as context geometry in place of the traced massing.

Strictly optional. Never referenced in onboarding.

---

## 8. Cost model

The whole design exists to keep marginal cost per session near zero.

| Cost | Per session | Mitigation |
|---|---|---|
| Static hosting | ~0 | Cloudflare Pages free tier |
| Aerial imagery | 0 | User supplies their own screenshot |
| 3D rendering | 0 | Client GPU |
| Storage | 0 | IndexedDB, user's device |
| **LLM calls** | **the only real cost** | See below |

LLM controls, in priority order:
1. Small, cheap model
2. Tight system prompt, no image input ever
3. Cap free turns per session (suggest 15), enforced in the Worker with a KV counter
4. Cache by normalized prompt + current-parameter hash
5. Ship Phase 3 last, behind a flag, so you can measure real cost before exposing it

**Set a hard monthly spend cap on the API key from day one.** A free tool with no auth will find abuse. Assume it will.

On ads: revenue at low traffic is close to noise, and most ad networks want established traffic before approving. Don't design around ad income existing. The correct stance is that the app costs you almost nothing to run, and ads may eventually offset the LLM line item.

---

## 9. Known hard parts

Flagging these so they get real attention rather than a first-attempt implementation.

**Scale calibration is the whole ballgame.** Every downstream number depends on `pxPerFoot`. Make the UI generous: magnified cursor, snapping, an explicit confirmation step that says "your driveway is 24.3 ft wide — does that look right?" Offer a second independent calibration as a cross-check. A 10% scale error makes everything subtly wrong in a way users won't diagnose.

**Roof geometry for hips is fiddly.** Gable and shed are straightforward. Hip on a non-rectangular footprint is a straight skeleton problem. For v1, restrict hip roofs to rectangular footprints and say so in the UI.

**Shadow quality in Three.js needs tuning.** Default shadow maps on a large ground plane produce acne and peter-panning. Budget real time for shadow camera bounds, bias, and a reasonable map size. Shadows are the single biggest contributor to "this looks real," so this is not polish, it's a feature.

**Mobile tracing.** Polygon tracing with a finger on a phone is genuinely unpleasant. Either build a proper magnifier-and-nudge interaction or gate tracing to larger viewports and tell mobile users to come back on a laptop. Don't ship a bad version of this.

**Self-intersecting polygons** will crash the extruder. Validate on every point add.

---

## 10. First session for Claude Code

1. Scaffold Vite + React + TS + r3f + zustand + zod + idb
2. Write `schema/project.ts` in full, with ranges on every numeric field
3. Write `geometry/lumber.ts` and `geometry/carport.ts` with unit tests on post positions and rafter counts
4. Stand up `scene/Viewport.tsx` rendering a default carport on a bare grid
5. Only then start Phase 0

Getting a correct, testable carport generator standing on an empty grid before touching site tracing means the hardest geometry is done while the codebase is still small.
