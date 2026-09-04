# 2 — Code-authored environment production

## Status

Implemented on 2026-09-04. Areas 1–3 and all three transitions now use readable,
typed, renderer-neutral layouts; semantic prop collision is compiled from those same
placements; the generic builder feeds the existing visual streaming manager; and the
curated promoted assets, browser preview, automated captures and assembled debug GLB
are operational.

The confirmed Decisions D1–D17 remain below as the implementation rationale. The
legacy Editor-first builder has been removed. `another-example/` is intentionally
still present because deletion requires the user's explicit approval, but the
checksummed ignored capture and all tracked runtime inputs are now independent of it.
Representative physical-device profiling remains part of the broader release work in
`1-graphics.md`; automated iPhone-12 viewport captures are complete.

Implementation evidence:

- `npm run authoring:assets:audit -- another-example` validates 621 captured files
  against the source while it exists, and `npm run authoring:assets:audit` keeps
  validating the checksummed capture after the source is deleted;
- `npm run authoring:assets:verify` validates 70 referenced promoted assets and
  tracked license evidence;
- `npm run authoring:world:validate` checks six chunks, 101 spawns, deterministic
  transformed collision, three gate centerlines and the closed Area 3 perimeter;
- `npm run authoring:world:capture` writes four renders and re-reads the assembled
  debug GLB with stable prop and `COLLIDER_*` names;
- `npm run authoring:world:smoke-runtime` crosses Areas 1â€“3â€“1â€“2 in the actual game
  at the 390 Ã— 844 reference viewport and rejects browser/runtime errors;
- `npm run build` and `npm run validate:release` are the production checks.

## Outcome

Recreate the complete three-area world using the successful technical pattern from
`another-example`:

- semantic prop and asset keys in central registries;
- typed, human-readable, renderer-neutral area and transition layout files;
- collision proxies defined once per semantic prop and instantiated from the same
  placement transforms as the visuals;
- deterministic terrain, roads, scatter and explicit prop placements;
- one generic rendering-layer `WorldBuilder`;
- one pure `WorldCollisionCompiler` for gameplay collision;
- the existing `WorldVisualStreamingManager` for visual residency;
- an immediate browser preview for fast iteration;
- one assembled debug GLB for Three.js Editor inspection;
- optional independently exported area/transition GLBs for production delivery.

The completed implementation must preserve Infuse gameplay authority, persistence,
locked-gate behavior, collision, combat spaces, mobile controls and presentation
fallbacks. It must also leave the repository independent of `another-example/` so
that directory can be deleted safely.

## Agreed direction

The following decisions are already part of this plan:

1. Typed world-layout code becomes the source of truth for stable area/transition
   dimensions and named prop placements.
2. Collision proxies are defined once on semantic prop definitions and compiled
   from those shared placements; structural transforms are never copied into a
   second collision file.
3. Gameplay simulation remains authoritative and renderer-independent: it consumes
   plain compiled collision values, never meshes or live Three.js objects.
4. Every area and transition has its own local-coordinate layout.
5. World placement is applied once to both visual and collision outputs.
6. The browser preview is the primary visual iteration surface.
7. A combined debug GLB is generated from the same layouts and builder/compiler.
8. Three.js Editor is used for inspection, measurement and discussion, not for
   authoritative edits or automatic round-tripping.
9. The raw development asset library stays outside Git.
10. Only assets referenced by an accepted game layout are promoted into tracked
   runtime directories.
11. The current streaming manager is retained; no generic ECS, physics-engine
    migration or replacement world runtime is introduced.

## Authoring, inspection and shipping flow

```text
ignored development asset library
                +
tracked renderer-neutral WorldLayout + WorldPropCatalog
                |
        +-------+-----------------------+
        |                               |
WorldCollisionCompiler             WorldBuilder
        |                          /            \
plain gameplay colliders   browser preview   assembled debug GLB
        |                         |          (visuals + collider helpers)
GameplayRuntime            accepted named placements
                                  |
                         promote referenced assets
                                  |
                     LayoutVisualProvider or chunk GLBs
                                  |
                     WorldVisualStreamingManager
                                  |
                         visual/runtime QA together
```

There is one authoritative edit path:

```text
typed prop/layout entry → recompile collision + regenerate preview/export
```

There is deliberately no authoritative path from an edited debug GLB back into the
game. If inspection shows that `A03_Corner_SW` needs another 90° of rotation, the
layout entry is changed and collision, preview and debug GLB are regenerated. This
avoids gameplay, code and an Editor document silently diverging.

## Debug GLB contract

The implementation must generate one combined file on demand:

```text
authoring/generated/debug/assembled-world-debug.glb
```

This file is for Three.js Editor and other glTF viewers. It must:

- be built by the same `WorldBuilder` used by the browser preview;
- contain all areas and all transitions, regardless of runtime streaming state;
- assemble chunks at their real world transforms;
- preserve every explicit prop name, including names such as
  `A03_Corner_SW`;
- include generated, clearly separated collision helpers named from their source,
  such as `COLLIDER_A03_Corner_SW`, for inspection only;
- preserve useful hierarchy groups for terrain, roads, structures, props,
  vegetation, transitions and collision helpers;
- attach diagnostic extras where practical: prop key, asset key, collision source,
  chunk ID and layout source;
- exclude gameplay enemies, combat effects, HUD and save state;
- be reproducible from tracked layouts plus the ignored development asset library;
- never be used as the gameplay source of truth;
- never be shipped as the one runtime world file.

The export command should also be able to generate independent local-root chunks:

```text
authoring/generated/chunks/areas/area-a01.glb
authoring/generated/chunks/areas/area-a02.glb
authoring/generated/chunks/areas/area-a03.glb
authoring/generated/chunks/transitions/transition-a01-a02-river.glb
authoring/generated/chunks/transitions/transition-a01-a03-ruined-wall.glb
authoring/generated/chunks/transitions/transition-a02-a03-fortified-river-gate.glb
```

Whether those chunk GLBs become the final runtime source is an evidence-based
performance decision. Code-authored layouts remain authoritative either way.

## Architectural boundaries

### Shared world content owns stable spatial authoring

Renderer-neutral typed world layouts under `src/data/world/` own:

- area/transition IDs, local bounds and world roots;
- explicitly named prop transforms;
- structure and wall composition, including deterministic structural primitives;
- terrain presentation, road/river splines and deterministic decorative scatter;
- explicit non-prop gameplay volumes for water, cliffs, outer boundaries and gates;
- stable links to semantic prop definitions, never file URLs or Three.js objects.

The semantic `WorldPropCatalog` owns the visual asset key and zero or more simple
collision proxies for each reusable prop archetype. A house, fountain or wall proxy
is authored once in normalized local metres and reused by every placement.
Palette/material variants with the same footprint should share a semantic collision
profile or prop base definition rather than copy the same proxy arrays.

Existing per-area gameplay JSON continues to own spawn IDs and local positions,
enemy tuning, boss IDs, rewards and other encounter content. Connection/unlock data
continues to own topology, requirements and dynamic gate state, while transition
world layouts own gate/crossing geometry. These files refer to stable area,
connection and placement IDs instead of duplicating structural transforms.

### Gameplay collision remains authoritative and renderer-independent

`WorldCollisionCompiler` is a pure, deterministic adapter over the shared world
layout and prop catalog. It resolves collision proxies and explicit gameplay volumes
to plain collision values before gameplay starts. `GameplayRuntime` remains the
authority for movement and for enabling state-dependent collision such as locked
gates.

No GLB bounds, mesh, loaded asset, terrain vertex, debug helper or Three.js Editor
object may become collision authority. Visual streaming or asset failure must never
add, remove or move gameplay collision.

### Rendering owns presentation only

`WorldBuilder` consumes the same placement data but owns only Three.js terrain,
roads, meshes, materials, shadows, occlusion metadata and export hierarchy. It does
not create the authoritative gameplay colliders. Visual-only exclusions may be
derived from plain gameplay positions, but gameplay never derives state from
rendered objects.

### Streaming remains presentation-only

`WorldVisualStreamingManager` remains responsible for deciding which area and
transition roots are prefetched, mounted and evicted. It must remain unaware of the
contents of a layout and whether a provider builds live objects or loads a baked
GLB.

The migration must support mixed residency during development, for example:

```text
Area 1                 typed layout provider
Transition A01/A02     typed layout provider
Area 2                 existing EnvironmentView fallback
Transition A01/A03     existing TransitionView fallback
Area 3                 production GLB provider
```

## Target spatial contract

All world-layout positions are chunk-local. One unit is one metre, `+X` is east,
`-Z` is north and `+Y` is up. Area/transition roots remain at local identity.

The intended dimensions from `three-editor.md` are:

| Chunk | Playable target | Visual target | Intended world root |
| --- | --- | --- | --- |
| Area 1 | 72 × 72 m | 84 × 84 m | `(0, 0, 0)` |
| Area 2 | 144 × 48 m | 156 × 60 m | `(36, 0, -60)` |
| Area 3 | 72 × 72 m | 84 × 84 m | `(72, 0, 0)` |
| A01 ↔ A02 river | 84 × 12 m nominal band | transition-owned | `(0, 0, -36)` |
| A01 ↔ A03 ruined wall | 12 × 84 m nominal band | transition-owned | `(36, 0, 0)` |
| A02 ↔ A03 fortified river/wall gate | 84 × 12 m nominal band | transition-owned | `(72, 0, -36)` |

Decision D1 resolves the previously conflicting Area 2 specifications in favor of
144 × 48 m playable, 156 × 60 m visual, local playable X `-72..72`, local visual X
`-78..78`, and world root `(36, 0, -60)`. Slice 0 must correct the stale alternative
values in `three-editor.md` before code or authored positions are migrated.

### Area 3 enclosure contract

Area 3 must read as a keep completely surrounded by a continuous ruined or partially
broken wall. Damage may create visual gaps and rubble, but it must not create an
unintended traversable exit. Only authored gates provide passage.

Ownership is split without duplicating wall pieces:

- `Transition_A01_A03_RuinedWall` owns the west shared wall section and its gate;
- `Transition_A02_A03_FortifiedRiverGate` owns the north shared wall section, its
  gate, and the fortified river crossing/bridge approach from Area 2;
- the Area 3 layout owns the remaining east and south perimeter plus non-transition
  wall continuations;
- corner pieces are assigned explicitly to exactly one owning chunk;
- compiled wall/rubble collision must close every non-gate opening while existing
  unlock state controls passage through both transition gates.

### Recreating the prototype composition

`another-example` is a visual and technical reference, not a coordinate source to
copy verbatim. Its three areas are 80 × 80 m and its placements use global world
coordinates. The port must:

1. classify each prototype object as area-owned, transition-owned or unused;
2. convert its position into normalized coordinates within the prototype chunk;
3. map that normalized position into the selected Infuse local playable/visual
   envelope;
4. keep model scale uniform rather than non-uniformly stretching models with the
   area;
5. preserve intended road, entrance, boss-arena and landmark relationships;
6. retune positions manually for Area 2's different aspect ratio;
7. validate every result against gameplay spawns, collision and gate openings;
8. preserve or improve the prototype's portrait-camera composition.

The target is a faithful recreation of the composition and visual language, not a
byte-for-byte or coordinate-for-coordinate port.

## Development asset library

### Location

All material retained from `another-example` for local world development goes under
one ignored root:

```text
authoring/local/world-development/
├─ source-assets/
│  └─ another-example-public-assets/   exact preserved tree
├─ references/
│  ├─ Layout.png
│  ├─ general-layout.png
│  ├─ iphone-preview.png
│  ├─ world-layout.glb
│  ├─ README.md
│  ├─ WORLD-LAYOUT.md
│  └─ prototype-source/                 relevant content/render/capture sources
├─ provenance/
│  ├─ ASSET-LICENSES.md
│  └─ upstream-license-files/
└─ inventory.json
```

`authoring/local/` is already ignored by Git. The capture step must additionally
verify the new root with `git check-ignore` so a future ignore-rule change cannot
accidentally stage the library.

Do not flatten the source asset tree. Many `.gltf` files use relative `.bin` and
texture URIs, and different packs can contain identical filenames. Preserve paths,
filename case and upstream license files exactly.

### Capture scope

Before relying on or deleting `another-example/`, capture:

- every file under `another-example/public/assets/`;
- its asset/license ledger and all included upstream license files;
- `Layout.png` and both reference screenshots;
- the combined exported GLB;
- `README.md` and `docs/WORLD-LAYOUT.md`;
- the prototype files that define asset keys, layouts, terrain, geometry, materials,
  camera, builder, streaming, export and capture behavior;
- enough package metadata to reproduce any conversion/capture command if needed.

Generated dependencies such as `node_modules`, `dist` and TypeScript build-info files
must not be captured.

### Capture tool

Add a tracked, reusable script rather than performing an undocumented manual copy.
The planned command is:

```text
npm run authoring:assets:capture -- another-example
```

It must:

1. resolve and validate the source and destination paths;
2. refuse to write outside `authoring/local/world-development/`;
3. copy the required trees without flattening them;
4. calculate SHA-256 and byte size for every captured file;
5. classify models, buffers, textures, licenses, references and source documents;
6. detect missing glTF dependencies and case-colliding paths;
7. write `inventory.json` with a schema version and source-relative paths;
8. report totals and failures;
9. leave `another-example/` untouched;
10. support an audit-only mode that verifies the captured copy later.

The inventory is local and ignored because it enumerates the full untracked asset
library. A small tracked schema/validator may be committed.

### Cloud limitation

The raw library is intentionally unavailable to Codex Cloud because it is ignored.
All work that inventories, visually chooses or transforms raw assets must therefore
run locally unless a separate authorized artifact store is introduced later. Cloud
tasks may work on generic code and tracked fixtures, and they may use assets only
after those assets have been promoted into the repository.

## Asset promotion policy

### Destination rules

World models, textures and chunk GLBs are URL-loaded runtime files and should
normally be promoted under:

```text
public/assets/world/
├─ shared/
│  ├─ models/
│  ├─ textures/
│  └─ licenses/
├─ areas/
└─ transitions/
```

Use `src/assets/` only for small assets that are intentionally imported into the
TypeScript/CSS module graph, such as UI icons. Do not place large world model packs
under `src/assets/` merely to make Vite discover them.

### Promotion means curation

Promotion must be driven by semantic asset keys referenced by accepted layouts. It
must not copy a whole source pack because one model was selected.

For each referenced asset key, the promotion command must:

1. resolve the source through the local development catalog;
2. calculate the full dependency closure for `.gltf` assets;
3. confirm provenance and license evidence;
4. normalize units, pivot/orientation and filename conventions where necessary;
5. prefer a self-contained GLB for promoted reusable models;
6. prune unused nodes/materials and deduplicate data where safe;
7. cap or convert textures according to measured mobile needs;
8. write the result first to ignored generated output;
9. validate the result by loading it again;
10. copy only the validated output and required license record into `public/`;
11. update the tracked production asset registry and `ASSET-LICENSES.md`;
12. fail if an active production layout key has no promoted runtime asset.

Planned commands:

```text
npm run authoring:assets:audit
npm run authoring:assets:promote -- <asset-key> [<asset-key>...]
npm run authoring:assets:verify-runtime
```

The ignored source library remains intact after promotion. It is the local master
copy; the tracked file is the curated, runtime-ready derivative.

### Development and production resolution

Layouts refer only to semantic keys such as `village.homeBlueA` or
`fortress.wallBroken`; they never contain raw filesystem or public URLs.

Use two resolvers behind one interface:

- `DevelopmentWorldAssetResolver` reads an ignored generated catalog and serves raw
  assets only through the local authoring viewer.
- `ProductionWorldAssetResolver` maps promoted keys to Vite-base-aware URLs under
  `public/assets/world/`.

Production builds must never fall back silently to `/@fs/`, `authoring/local` or
`another-example`. Missing promotion is a validation error.

## Typed shared world-layout format

### Proposed tracked structure

```text
src/data/world/
├─ WorldAssetKeys.ts
├─ WorldLayout.ts
├─ WorldPropCatalog.ts
├─ areas/
│  ├─ areaA01Layout.ts
│  ├─ areaA02Layout.ts
│  └─ areaA03Layout.ts
├─ transitions/
│  ├─ transitionA01A02River.ts
│  ├─ transitionA01A03RuinedWall.ts
│  └─ transitionA02A03FortifiedRiverGate.ts
└─ index.ts

src/domain/world/
├─ WorldPlacement.ts
├─ WorldCollision.ts
├─ WorldCollisionCompiler.ts
└─ CollisionMath.ts

src/rendering/environment/
├─ WorldVisualAssetCatalog.ts
├─ WorldBuilder.ts
├─ WorldAssetLibrary.ts
├─ LayoutVisualProvider.ts
├─ StreamedGlbVisualProvider.ts
└─ WorldVisualStreamingManager.ts
```

Names may be adjusted to existing conventions during implementation, but the
boundaries must remain: shared authored data, pure collision compilation, Three.js
construction, asset loading and provider lifecycle are separate concerns. Neither
`src/data/world/` nor `src/domain/world/` may import Three.js or rendering modules.
Domain types/compiler expose only the minimal structural interfaces they require;
concrete content modules may satisfy/import those types, but domain code must not
import individual Area 1/2/3 content modules. The game/config composition layer
passes the selected layouts and prop catalog into the compiler.

### Minimum data model

The concrete interfaces should be compact and use only plain serializable values:

```ts
type Vec2Tuple = readonly [x: number, z: number];
type Vec3Tuple = readonly [x: number, y: number, z: number];

type Bounds2D = {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
};

type OrientedRectangleProxy = {
  readonly kind: "orientedRectangle";
  readonly center: Vec2Tuple;
  readonly size: readonly [width: number, depth: number];
  readonly rotationY?: number;
};

type CircleProxy = {
  readonly kind: "circle";
  readonly center: Vec2Tuple;
  readonly radius: number;
};

type CollisionProxy = OrientedRectangleProxy | CircleProxy;

type WorldPropDefinition = {
  readonly visualAsset: WorldVisualAssetKey;
  readonly collision?: readonly CollisionProxy[];
  readonly defaultTags?: readonly string[];
};

type PropPlacement = {
  readonly name: string;
  readonly prop: WorldPropKey;
  readonly position: Vec3Tuple;
  readonly rotationY?: number;
  readonly scale?: number;
  readonly collision?: "prop-default" | "none";
  readonly cameraOccluder?: boolean;
  readonly tags?: readonly string[];
};

type ScatterPlacement = {
  readonly prefix: string;
  readonly props: readonly WorldPropKey[];
  readonly count: number;
  readonly bounds: Bounds2D;
  readonly seed: number;
  readonly scaleRange: readonly [number, number];
  readonly collision?: "none" | "prop-default";
  readonly exclusions?: readonly VisualExclusion[];
  readonly minimumSpacing?: number;
};

type RoadPlacement = {
  readonly name: string;
  readonly points: readonly Vec2Tuple[];
  readonly width: number;
  readonly material: WorldMaterialKey;
  readonly yOffset?: number;
};

type ExplicitCollisionVolume = {
  readonly name: string;
  readonly shapes: readonly CollisionProxy[];
  readonly activation?: CollisionActivation;
};

type AreaWorldLayout = {
  readonly kind: "area";
  readonly areaId: number;
  readonly rootName: string;
  readonly worldRoot: Vec3Tuple;
  readonly playableBounds: Bounds2D;
  readonly visualBounds: Bounds2D;
  readonly terrain: TerrainPresentation;
  readonly roads: readonly RoadPlacement[];
  readonly props: readonly PropPlacement[];
  readonly scatters: readonly ScatterPlacement[];
  readonly explicitCollision?: readonly ExplicitCollisionVolume[];
};

type TransitionWorldLayout = {
  readonly kind: "transition";
  readonly connectionId: string;
  readonly rootName: string;
  readonly worldRoot: Vec3Tuple;
  readonly localBounds: Bounds2D;
  readonly surfaces: readonly SurfacePlacement[];
  readonly roads: readonly RoadPlacement[];
  readonly props: readonly PropPlacement[];
  readonly scatters: readonly ScatterPlacement[];
  readonly explicitCollision?: readonly ExplicitCollisionVolume[];
};
```

No interface may expose `THREE.Object3D`, geometries, materials, DOM nodes or asset
loader objects. The exact `CollisionActivation` union should use stable gameplay
IDs; the first required case is a connection/gate collider active while locked.

`WorldPropKey` is a semantic archetype such as `fortress.wallStraight` or
`village.homeBlueA`, not a filename. Its definition may point to a replaceable
visual asset while preserving an intentional gameplay footprint.

### Structural prop example

Conceptually, the catalog defines the footprint once:

```ts
const WORLD_PROPS = {
  "fortress.wallStraight": {
    visualAsset: "kaykit.stoneWall",
    collision: [
      { kind: "orientedRectangle", center: [0, 0], size: [7, 0.8] },
    ],
  },
  "village.fountain": {
    visualAsset: "infuse.fountain",
    collision: [{ kind: "circle", center: [0, 0], radius: 1.3 }],
  },
} as const;
```

The world layout supplies the transform once:

```ts
{
  name: "A03_Wall_01",
  prop: "fortress.wallStraight",
  position: [18, 0, -12],
  rotationY: Math.PI / 2,
  scale: 1,
}
```

`WorldBuilder` uses that transform for the visual and `WorldCollisionCompiler` uses
it for the catalog proxy. Changing the placement cannot leave an old manually copied
structural collider behind.

### Layout rules

- Every explicit object name is globally unique and stable.
- Every position is local to its shipping chunk.
- Rotations use radians internally; helper constants may express quarter/half turns
  readably.
- Collision proxies are authored in normalized metres relative to the normalized
  prop pivot at scale 1.
- The visual asset catalog must normalize raw model units, base orientation and pivot
  into that same canonical prop frame before applying the placement transform.
- A placement transform is resolved once and applied to both its visual instance and
  every default collision proxy; its coordinates are never copied into area JSON.
- Prop scale is uniform. It scales collision centers, dimensions and radii by the
  same value used by rendering.
- A compound prop may define multiple proxy shapes. A decorative use may explicitly
  select `collision: "none"`.
- Omitting a normal prop placement's `collision` uses `"prop-default"`; a prop with
  no proxies remains non-colliding. The opt-out must be written explicitly when a
  normally collidable prop is intentionally decorative.
- Repeated wall pieces are data entries or a deterministic `wallRun`-style layout
  primitive, not an Area 3 branch hidden inside either compiler or builder. A wall
  run may merge adjacent collinear proxies when that improves movement and cost.
- Rivers, bridge approaches, gates, bank rocks and seam vegetation belong to
  transition layouts.
- Scatter is deterministic and must not change between reloads with the same seed.
- Scatter is non-colliding by default. Collision is opt-in only when the same pure
  deterministic expansion is consumed by both the collision compiler and renderer.
- Scatter must honor authored exclusions plus plain gameplay clearances supplied by
  an adapter.
- Major landmarks are explicit placements, never scatter results.
- GLB/mesh bounding boxes never generate gameplay collision automatically.
- Layout validation fails on duplicate names, unknown prop/asset keys, malformed
  proxies, non-finite values, bad local bounds or objects outside permitted visual
  aprons.

## Collision compilation and movement shapes

`WorldCollisionCompiler` accepts only the world layouts, semantic prop catalog and
plain connection state definitions. For every collidable placement it:

1. looks up the prop's local proxy shapes;
2. combines placement rotation with each proxy's local rotation;
3. scales proxy offsets and dimensions using the placement's uniform scale;
4. rotates the proxy offset around the shared normalized pivot;
5. applies the chunk world root;
6. emits stable plain collider IDs derived from the placement name;
7. retains activation metadata for runtime-controlled gates/barriers.

Thus 24 placements of `fortress.wallStraight` automatically produce 24 correctly
positioned and rotated colliders without 24 copied coordinate entries. A wall-run
primitive may instead emit one or a few continuous rectangles when its segments are
collinear, preventing tiny seams from catching the hero.

The current runtime supports only axis-aligned rectangles. Because the accepted
prototype freely rotates houses and ruins, the migration must add at least:

- circles for fountains, trunks and round landmarks when intentionally solid;
- oriented rectangles for houses, walls and rectangular structures;
- circle-versus-oriented-rectangle overlap and sliding/resolution for the existing
  circular hero/enemy footprints.

Implement this as compact renderer-independent math. Do not introduce Rapier or
another physics engine for static top-down blockers unless later gameplay requires
meaningful rigid-body physics.

Automatic prop proxies are not the only collision source. Explicit renderer-neutral
volumes remain appropriate for water, cliffs, playable borders, encounter barriers
and state-dependent gates because those are gameplay regions rather than model
footprints. They live in the owning area/transition world layout and use no visual
mesh as authority.

All colliders are compiled before gameplay starts and remain available regardless of
visual streaming, GLB loading, WebGL context state or cosmetic failure. Production
visual GLBs contain no authoritative colliders; only the assembled debug GLB includes
named visual helper representations of the compiled shapes.

## Generic WorldBuilder

`WorldBuilder` is a rendering adapter. It accepts a world layout, semantic prop
catalog, asset resolver/library, material library and build mode, and returns one
owned visual chunk.

It must provide equivalent generic paths for every area and transition:

1. create an identity local root with the declared canonical name;
2. create terrain from the declared presentation profile;
3. create terrain-following spline roads and rivers;
4. preload the unique asset-key set for the chunk;
5. resolve prop keys and instantiate explicit named visuals using the shared
   placement transforms;
6. resolve deterministic scatter and exclusions;
7. assign shadows, occluder metadata and diagnostic extras;
8. return explicit cleanup ownership without disposing shared cached resources.

It must not contain branches such as `if areaId === 3, build fortress walls`. Area
identity changes data selection only.

### Build modes

- `authoring`: expand every placement into a separately named selectable object for
  browser inspection and debug GLB export.
- `runtime`: initially preserve the same hierarchy; introduce instancing/batching
  only after measurements demonstrate a need.
- `export`: clone or rebuild an export-safe hierarchy without runtime callbacks or
  transient helpers.

The three modes must share placement resolution, terrain generation and material
selection. Placement-transform helpers must also be shared with
`WorldCollisionCompiler`; a separate transform approximation path is not acceptable.

### Terrain and materials

Start with the prototype's successful low-amplitude deterministic height function,
tiled PBR materials and explicit themed profiles. Do not require THREE.Terrain or
manual sculpt state for the first production pass.

Terrain profiles may vary height by area but must enforce transition-edge policies
so traversable seams align. Roads sample the same height provider used by terrain.
Water and waterfalls remain named transition/area surfaces with runtime-safe simple
materials unless profiling supports more expensive effects.

## Browser authoring preview

Refactor the existing local authoring viewer so it imports the production world
layouts, `WorldBuilder` and `WorldCollisionCompiler` instead of maintaining separate
visual or collision approximations.

Required preview capabilities:

- load all areas/transitions or isolate any one chunk;
- development asset resolver for the ignored local library;
- production resolver mode to verify promoted assets;
- isolate a semantic prop at normalized scale 1 and show its pivot, ground footprint
  and collision proxies;
- optionally suggest an initial proxy from inspected mesh bounds as an authoring aid,
  but require an explicit reviewed proxy literal in `WorldPropCatalog` before it can
  affect gameplay;
- adjust/test proxy offset, dimensions and local rotation in the calibration view and
  copy the resulting typed-data snippet;
- inspect all placements using a selected prop/collision profile so one proxy change
  can be checked for every variant and instance;
- portrait follow-camera preset matching Infuse;
- full-world overview camera;
- free orbit/pan/zoom inspection;
- toggle terrain, roads, transitions, props, scatter, bounds, gameplay spawns,
  generated collision proxies, explicit collision volumes and gate clearances;
- object picking and hierarchy selection;
- search by stable object name;
- select a prop and its generated collider helpers together;
- display selected object name, prop key, asset key, position, rotation, scale and
  resolved collision shapes;
- copy a concise change request such as
  `A03_Corner_SW: rotate Y +90 degrees`;
- reload layouts without rebuilding unrelated gameplay systems;
- show missing assets and placement-validation errors visibly;
- flag missing/invalid prop proxies, unintended collision opt-outs, gaps in wall
  runs and collision intruding into required movement clearances;
- display draw calls, triangles, geometries, textures and estimated asset bytes;
- switch between Full and Reduced graphics assumptions where relevant.

The preview is the normal editing loop because it is faster than exporting and
reimporting a GLB for every change.

### Automated captures

Port the useful capture behavior from `another-example` into tracked scripts. The
capture must use the same preview and builder and produce at least:

```text
authoring/generated/captures/general-layout.png
authoring/generated/captures/iphone-12-area-a01.png
authoring/generated/captures/iphone-12-area-a02.png
authoring/generated/captures/iphone-12-area-a03.png
```

Add deterministic camera presets so visual diffs are meaningful. Captures are local
generated artifacts and remain ignored unless a specific review artifact is
deliberately promoted.

## Runtime integration

### Collision runtime adapter

Compile all area and transition collision from tracked world content during game
composition, before any visual provider is requested. The adapter supplies plain
collision shapes and stable IDs to `GameplayRuntime`; it never supplies meshes or
provider lifecycle objects.

Static prop collision is always present. State-dependent explicit volumes retain
their stable connection/gate IDs so gameplay can enable or disable them from unlock
state. Unmounting an area or transition visual must have no effect on either class.

During migration, the current axis-aligned `CollisionShape` and resolution code may
coexist with new compiled shapes behind one small union/adapter. Remove legacy
manually duplicated structural rectangles only after equivalent generated collision
passes movement QA.

### LayoutVisualProvider

Add a provider that adapts a typed layout to the existing provider interface:

- `prefetch()` requests the asset keys used by one chunk;
- `create()` asks `WorldBuilder` for a root and returns its disposal callback;
- the root is mounted by `WorldVisualStreamingManager`;
- late completion and eviction remain managed by the existing manager;
- failures preserve the existing lightweight procedural fallback;
- world placement comes from metadata derived from the shared world layout, never
  from an imported GLB or duplicated provider constants.

Do not replace `WorldVisualStreamingManager` with the prototype's bounds-only
`AreaStreamer`. Infuse's current manager correctly understands area and transition
providers, proximity, hysteresis and fallback lifecycles.

### Production GLB option

After a chunk is visually accepted, the exporter may bake it into a local-root GLB
and swap its provider to `StreamedGlbVisualProvider`. This must not require changing
the layout, compiled collision or gameplay content.

Choose live layout construction versus baked chunk GLB per measured results:

- use live construction while layout iteration is active;
- benchmark startup, draw calls, memory and disposal on the reference phone;
- bake only when it materially improves delivery/runtime behavior;
- keep the typed layout as the regeneration source even after baking.

## Gameplay-coordinate migration

The live game currently uses smaller area dimensions than the production contract.
Changing dimensions is not a visual-only edit. Implement it as a dedicated slice.

The migration must update together:

- move canonical `worldRoot`, playable bounds and visual bounds into the shared world
  layouts, removing duplicate origin/size constants from consumers;
- compose runtime `AreaDefinition` values from encounter JSON plus the corresponding
  area world layout, then remove migrated `worldOrigin`, `size` and structural
  `collision` fields from area JSON after all consumers switch;
- all local/world spawn positions;
- hero initial/resurrection placement;
- move connection/gate positions, axes, widths and barrier depths into the owning
  transition world layouts while retaining topology/unlock rules in connection data;
- compose runtime `WorldConnection` values from connection topology/unlock data plus
  the corresponding transition world layout, with a one-to-one ID validator;
- semantic prop definitions and their normalized collision proxies;
- explicit non-prop collision volumes and legacy rectangle migration;
- oriented-rectangle/circle collision math and movement resolution;
- lake/river barrier calculations;
- camera/fog/streaming thresholds if visibility distances change;
- encounter clearances and combat pacing;
- any save fields that persist positions, if present;
- diagnostics and screenshot presets.

Use an explicit deterministic transform from old playable bounds into new playable
bounds as a starting point, then hand-review every spawn, boss, gate, prop proxy and
explicit collision-critical placement. Structural collision follows the shared prop
placement automatically; do not create a parallel coordinate list or silently
stretch encounter geometry.

The save migration must preserve supported progression, inventory, equipment,
unlocks, spawn rolls, defeats and respawn deadlines. If hero position is not
persisted, no artificial position migration should be added.

## Implementation slices

Every slice must keep `npm run build` green. World-facing slices also require the
authoring validators and a portrait capture before they are considered complete.

### Slice 0 — Apply confirmed decisions and freeze the spatial contract

- apply confirmed Decisions D1–D17 to schemas, constants and documentation;
- write one canonical area/transition coordinate table;
- correct contradictory dimensions in `three-editor.md`;
- document the retained blue/green/red palette, fortified A02/A03 river crossing,
  and complete Area 3 wall enclosure;
- record that shared typed world layouts are authoritative and Editor edits do not
  round-trip;
- record the accepted shared-placement/collision decisions D13–D17.

Exit: there is exactly one unambiguous coordinate and ownership contract.

### Slice 1 — Capture and audit `another-example`

- add the safe capture/audit script;
- create `authoring/local/world-development/`;
- capture raw assets, references, provenance and relevant prototype source;
- generate and verify the local inventory;
- prove the entire root is ignored;
- compare counts, sizes and hashes with the source;
- do not delete the source folder.

Exit: deleting the prototype would not lose an asset, visual reference, license
record or implementation reference, though deletion remains deferred.

### Slice 2 — Shared world types, prop catalog and validation

- define semantic asset, material and prop-archetype keys;
- implement renderer-neutral, plain-value world-layout interfaces under
  `src/data/world/`;
- define prop collision proxies and reusable collision profiles in normalized metres,
  independent of asset URLs;
- add per-area and per-transition modules with empty/minimal fixtures;
- move canonical world roots/playable bounds into this shared source without leaving
  duplicate constants in rendering;
- validate names, bounds, numbers, prop/asset keys, proxy shapes and root identity;
- add deterministic random/scatter helpers with repeatability checks;
- add tracked tiny fixtures so generic code can be validated without ignored assets.

Exit: a minimal typed chunk and collidable prop catalog validate in local and cloud
environments without importing Three.js.

### Slice 3 — Collision compiler and movement-shape support

- add pure local-to-world placement/proxy transform helpers;
- compile automatic prop collision and explicit gameplay volumes with stable IDs;
- extend collision values and movement resolution for circles and oriented
  rectangles;
- support compound proxies, uniform placement scale and collision opt-out;
- support state-dependent explicit gate/connection volumes;
- keep compiled collision resident independently of visual streaming;
- cover rotation, scaling, compound shapes, 24 repeated wall placements, disabled
  collision, wall-run merging and cosmetic asset failure with deterministic checks;
- retain legacy rectangles only as a migration adapter until parity is verified.

Exit: moving, rotating or scaling one fixture prop changes its visual placement input
once and deterministically produces the correct plain gameplay collider without
loading its asset.

### Slice 4 — Generic WorldBuilder and development resolver

- implement cached asset loading behind the resolver interface;
- resolve the shared semantic prop catalog;
- build terrain, roads, explicit props, structural primitives and scatter generically;
- use the exact placement-transform helpers covered by the collision compiler;
- implement shared-resource-safe disposal;
- support authoring/runtime/export modes;
- forbid area-specific branches in the builder;
- prove missing development assets produce actionable errors.

Exit: one fixture layout builds without `EnvironmentView` logic.

### Slice 5 — Browser preview, selection and debug GLB

- refactor the authoring viewer around the real `WorldBuilder` and
  `WorldCollisionCompiler`;
- add chunk toggles, compiled collider overlays, gameplay clearances and production
  camera presets;
- add linked prop/collider picking, search and transform inspection;
- add normalized prop calibration, non-authoritative bounds suggestion and typed
  proxy-snippet copyout;
- generate the combined debug GLB with unique `COLLIDER_<collision-id>` helpers
  linked back to their source placement in metadata;
- reimport the GLB and verify stable visual/collider names and transforms;
- port deterministic overview and iPhone capture automation.

Exit: a named fixture prop and its generated proxy can be found together in the
browser and Three.js Editor; one layout edit updates both after regeneration.

### Slice 6 — Gameplay spatial migration

- apply the approved production dimensions/origins;
- migrate runtime `AreaDefinition`/`WorldConnection` composition to join gameplay
  JSON with shared area/transition layouts by stable ID;
- transform and hand-review spawns, explicit volumes and gates;
- replace manually duplicated structural rectangles with prop-generated collision;
- verify rotated buildings/walls and compound proxies provide smooth traversal;
- keep gameplay transitions locked and bidirectional as authored;
- verify save normalization/migration;
- validate all crossings using procedural fallback visuals first.

Exit: gameplay is stable at the final spatial dimensions before detailed visuals
depend on them.

### Slice 7 — Area 1 recreation

- port Greenhaven's terrain/material character;
- port and retune road splines;
- recreate fountain, village buildings, gardens and activity props using semantic
  definitions with reviewed reusable collision proxies;
- recreate perimeter vegetation with deterministic exclusions;
- preserve boss, spawn, gate and mobile movement clearances;
- match the accepted portrait/full-world visual character;
- select and promote only accepted Area 1 assets.

Exit: Area 1 visuals and compiled collision are jointly accepted in browser preview
and the Infuse runtime without copied structural coordinates.

### Slice 8 — A01/A02 and A01/A03 transitions

- build the river/causeway transition as a separate layout;
- build the ruined-wall/gate transition as a separate layout;
- keep explicit gate/barrier collision controlled by existing gameplay state;
- ensure both transitions remain stable while either neighboring area streams;
- validate local roots, overlaps, collision alignment and both traversal directions;
- promote only accepted transition assets.

Exit: Area 1 boundaries are production-ready and no transition visual is duplicated
inside an area.

### Slice 9 — Areas 2 and 3 plus A02/A03 transition

- recreate Highwood's forest, water, elevation and landmarks within its approved
  non-square dimensions;
- recreate Fallen Keep with named modular walls, gates, ruins and camera-safe
  cutaways;
- generate modular wall collision from the same placements or wall-run primitives;
- author the fortified A02/A03 river crossing, wall section and gate as a separate
  transition layout;
- complete Area 3's continuous ruined/partially broken perimeter, leaving only its
  two state-controlled gates traversable;
- keep every major structure explicit and searchable by name;
- promote accepted assets incrementally.

Exit: the whole connected world is visually complete and every chunk can be
isolated, streamed and exported.

### Slice 10 — Runtime provider migration

- add `LayoutVisualProvider` without changing the streaming algorithm;
- switch providers one accepted chunk at a time;
- preserve procedural fallbacks until the replacement passes QA;
- prove compiled collision remains unchanged while either provider mounts, fails or
  evicts;
- verify enemy presentation activation, gates, cinematics and occlusion registration;
- ensure no runtime URL refers to ignored or prototype paths.

Exit: all six visual chunks use accepted typed layouts or generated GLBs through the
existing streaming manager.

### Slice 11 — Promotion, optimization and production decision

- generate the complete referenced-asset set;
- promote and license only that set;
- measure live layout construction against baked chunk GLBs;
- introduce instancing, mesh optimization or texture compression only where measured;
- choose provider form per chunk and record the result;
- validate Full/Reduced and Smooth/30 FPS modes on the reference phone.

Exit: the shipping representation is selected from evidence and stays within project
load, payload and runtime budgets.

### Slice 12 — Remove obsolete authoring paths and certify deletion

- remove unused Editor-first/THREE.Terrain runtime-authoring code only after the new
  flow covers its required behavior;
- remove unused procedural layout code after fallbacks are no longer required, or
  retain an intentionally minimal fallback;
- remove legacy manually duplicated structural collision entries after generated
  parity is accepted;
- update `three-editor.md`, `authoring/README.md`, `ARCHITECTURE.md`, roadmap and asset
  licenses to the final workflow;
- run the deletion-readiness checks below;
- obtain explicit confirmation before deleting `another-example/`.

Exit: the main repository and ignored development library contain everything needed
to build, inspect and maintain the world independently.

## Validation and QA

### Static validation

Fail on:

- duplicate or unstable explicit object names;
- missing/unknown semantic prop or visual asset keys;
- active layout keys without promoted production assets;
- non-finite transforms or non-uniform model scales where forbidden;
- malformed, negative-sized or unsupported collision proxies;
- a collidable prop whose visual normalization/pivot no longer matches its reviewed
  canonical prop frame;
- duplicate generated collider IDs;
- a placement tagged as structurally solid without a default proxy or explicit
  reviewed opt-out;
- collision expansion that uses a different transform result than visual placement;
- canonical world roots/playable bounds duplicated in rendering constants;
- props outside chunk visual bounds without an explicit exemption;
- wrong area/transition root transforms;
- transition-owned names inside area layouts;
- malformed road/river control points;
- missing external glTF dependencies;
- missing provenance for a promoted asset;
- production references to `authoring/local`, `/@fs/` or `another-example`;
- authoring/debug helpers inside production chunks.

Warn on:

- generated or explicit collision intruding into spawn, road or gate clearances;
- gaps or overlaps between adjacent wall-run collision shapes;
- collision proxies substantially larger than their inspected visuals;
- collision-enabled scatter or excessive compiled collider counts;
- scatter density above the per-area budget;
- large texture or GLB sizes;
- excessive material count;
- terrain/road/water height disagreement;
- manual props below terrain;
- repeated geometry that may benefit from instancing.

### Functional QA

Verify:

- all three connections in both directions;
- locked and unlocked gate states;
- Area 3 perimeter collision has no unintended opening outside the A01/A03 and
  A02/A03 gates, including visually broken wall sections;
- boss defeat and gate-opening presentation;
- no visual gap while approaching/crossing a seam;
- correct visual eviction after leaving an area;
- gameplay collision unchanged by visual load failure;
- gameplay collision unchanged by visual mount, eviction or GLB-provider selection;
- one transform edit moves/rotates/scales a structural visual and its collider
  together;
- compound, circle and oriented-rectangle collision resolves without corner snagging;
- decorative collision opt-outs and default non-colliding scatter;
- combat clearances around every spawn group;
- death, resurrection, reload and persisted progression;
- foreground occlusion and camera-safe fortress walls;
- WebGL context loss/recovery;
- missing/corrupt cosmetic asset fallback.

### Visual and performance QA

At minimum capture and inspect:

- full-world overview;
- iPhone 12 portrait view in every area;
- every transition from both sides;
- the largest combat groups and each boss arena;
- Full/Smooth, Full/30 FPS, Reduced/Smooth and Reduced/30 FPS.

Record load time, transferred bytes, draw calls, triangles, geometries, textures,
active mixers and mounted chunk IDs. Desktop emulation is not sufficient evidence
for final mobile acceptance.

## `another-example/` deletion-readiness gate

The directory is safe to delete only when all of the following are true:

1. The capture inventory validates against the original source tree.
2. Raw assets and dependency files exist under the ignored development root.
3. Reference layout image, screenshots and combined GLB are preserved locally.
4. Provenance and upstream license evidence are preserved.
5. Relevant prototype behavior has either been implemented or explicitly rejected.
6. All active typed world layouts, prop definitions and collision rules live in the
   main tracked source tree.
7. Every runtime-used asset is promoted and listed in `ASSET-LICENSES.md`.
8. No tracked source, script, configuration or documentation depends on
   `another-example/`.
9. `rg -n "another-example"` returns only an intentional historical note, or no
   results.
10. The full build, release validation, authoring validation and runtime asset audit
    pass without that folder on a temporary copy/worktree.
11. Browser preview and assembled debug GLB generation succeed from the retained
    inputs.
12. The complete runtime world passes visual, transition, gameplay and mobile QA.
13. The user explicitly approves deletion after reviewing the final report.

Deletion must not be part of an earlier migration script or an automatic cleanup
step.

## Confirmed implementation decisions

### World and art direction

| ID | Decision | Confirmed direction |
| --- | --- | --- |
| D1 | Area 2 spatial contract | Use **144 × 48 m playable, 156 × 60 m visual, local playable X `-72..72`, local visual X `-78..78`, world root `(36,0,-60)`**. This exactly spans the combined 72 m Areas 1 and 3. |
| D2 | Prototype fidelity | Recreate its composition and visual language rather than copying literal coordinates. Retune for Infuse combat, transitions and target dimensions. |
| D3 | A02 ↔ A03 and Area 3 enclosure | Use a **fortified river crossing terminating at a gate in Area 3's wall**. Area 3 is completely surrounded by a continuous ruined/partially broken wall; broken-looking sections remain non-traversable, and only the A01/A03 and A02/A03 gates permit passage. |
| D4 | Area palette | Retain blue Greenhaven, green Highwood and red Fallen Keep for the first complete recreation. Replace individual assets only after the coherent baseline is matched. |

### Accepted defaults

| ID | Decision | Confirmed direction |
| --- | --- | --- |
| D5 | Terrain source | Use compact deterministic typed terrain profiles and height functions. Do not make THREE.Terrain or manual sculpt state a prerequisite. |
| D6 | Three.js Editor authority | Inspection only. All accepted changes return to typed layouts by stable name. No GLB-to-layout round-trip in this project slice. |
| D7 | Daily editing surface | Browser preview first; debug GLB/Three.js Editor for hierarchy, depth, occlusion and difficult spatial inspection. |
| D8 | Runtime representation | Start with `LayoutVisualProvider`; benchmark against baked chunk GLBs after visual acceptance and choose from evidence. |
| D9 | Promoted model format | Prefer normalized self-contained GLB for reusable runtime models. Preserve raw upstream glTF trees only in the ignored library. |
| D10 | Asset capture scope | Capture all prototype public assets and all references/provenance, even though only referenced assets will be promoted. |
| D11 | Where visual migration runs | Run locally while it depends on ignored assets. Cloud work is limited to generic tracked code/fixtures until assets are promoted. |
| D12 | Existing local Editor source | Preserve it in the ignored development backup during migration, but do not treat it as authoritative over typed layouts. |

### Shared-layout and collision decisions

The following decisions were accepted after reviewing the risk of manually
duplicating structural coordinates:

| ID | Decision | Accepted direction |
| --- | --- | --- |
| D13 | Shared spatial source | Rename the planned visual-only layout boundary to a renderer-neutral typed `WorldLayout` under `src/data/world/`. Rendering and collision compilation consume the same named placements. |
| D14 | Reusable prop collision | Define zero or more intentional local collision proxies once per semantic `WorldPropKey`; every placement automatically transforms those proxies with its position, rotation and uniform scale. Never copy structural placement coordinates into `area-*.json`. |
| D15 | Collision shapes | Add circles and oriented rectangles, including compound proxy sets, using compact pure collision math. Do not add a physics engine for this migration. |
| D16 | Scatter and overrides | Decorative scatter is non-colliding by default. Allow explicit prop collision opt-in for deterministic scatter and an explicit `collision: "none"` override for decorative reuse. |
| D17 | Non-prop and dynamic barriers | Keep water, cliffs, playable borders, encounter barriers and state-dependent gates as explicit renderer-neutral gameplay volumes owned by the relevant area/transition layout and activated by stable gameplay IDs. |

## Non-goals

- Do not import the standalone game's simplified movement or streaming logic.
- Do not make visual meshes collision authority.
- Do not calculate gameplay collision from GLB/mesh bounding boxes at runtime.
- Do not maintain a separate list of structural collider coordinates beside prop
  placement coordinates.
- Do not copy all development assets into Git.
- Do not ship the assembled debug GLB as the runtime world.
- Do not maintain simultaneous authoritative layout code and Editor JSON.
- Do not add automatic GLB-to-TypeScript round-tripping in this slice.
- Do not add a generic ECS, physics-engine migration or new save model.
- Do not optimize every asset before it is selected and visually accepted.
- Do not delete `another-example/` until the deletion-readiness gate passes.

## Definition of done

The initiative is complete when:

1. Areas 1–3 use the approved production dimensions and remain continuously
   traversable under existing progression rules; Area 3 is continuously enclosed by
   its ruined wall and has no passage except the two state-controlled gates.
2. Each area and transition has a readable typed shared world-layout file with stable
   names and local coordinates.
3. Each semantic collidable prop defines its proxy shapes once, and every instance
   receives correctly transformed collision without duplicated coordinates.
4. A pure `WorldCollisionCompiler` produces stable collision values independently of
   Three.js, asset loading and visual streaming.
5. A single generic `WorldBuilder` constructs every visual chunk from the same
   placements.
6. The browser preview uses the exact builder/compiler outputs and supports linked
   prop/collider inspection.
7. One assembled debug GLB can be opened in Three.js Editor with all named props and
   clearly separated `COLLIDER_*` helpers.
8. The existing streaming manager mounts the accepted area/transition providers
   without owning or changing collision.
9. Gameplay, collision, persistence and gate state remain renderer-independent.
10. Only referenced, licensed, validated assets are present in tracked runtime paths.
11. The complete raw prototype asset/reference set is retained under one ignored local
   development root.
12. Visual quality matches or improves upon the accepted `another-example` captures
    while respecting Infuse's combat and transition requirements.
13. Mobile performance and payload constraints are verified on representative
    hardware.
14. The deletion-readiness gate passes and the user can safely remove
    `another-example/`.
