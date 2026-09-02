# World Authoring Builder + Viewer — implementation plan

## Purpose

Build a local production-authoring toolchain that converts a rough Three.js Editor scene into clean, deterministic Infuse world chunks.

The user should be able to spend authoring time on **composition and asset placement** rather than hand-building curved roads, rivers, UVs, export hierarchies and chunk transforms.

This plan is self-contained. Read `AGENTS.md` before implementation and follow all repository build/version/commit requirements.

## Desired user workflow

```text
1. Open Three.js Editor
2. Place exact-size rough area grounds
3. Place buildings, fountain, trees, rocks, bridge, walls and props manually
4. Express roads/rivers with simple GUIDE_* objects
5. Export Three.js Editor JSON to:
   authoring/local/three-editor/infuse-world.json
6. Run:
   npm run authoring:build
7. Inspect generated result with:
   npm run authoring:viewer
8. Iterate in Three.js Editor until satisfied
9. Run:
   npm run authoring:promote
10. Commit only the final shipping GLBs + code/data changes
```

The builder must **never mutate** `authoring/local/three-editor/infuse-world.json`.

## Why this tool exists

Areas 1-3 are small authored RPG levels, not large natural landscapes. Terrain generators introduced more authoring complexity than value for the current scale.

Three.js Editor is useful for visual composition but inefficient for:

- natural curved roads;
- circular/ring roads around landmarks;
- smooth rivers;
- predictable tiled UVs on generated strips;
- consistently stripping editor-only helpers;
- preserving chunk-local roots while authoring the world assembled;
- repeatedly exporting many runtime GLBs;
- validating file size / geometry / naming mistakes.

The builder solves those repetitive technical tasks while preserving manual creative placement.

## Non-goals for the first implementation

Do **not** include these in v1 unless required to make the core pipeline work:

- general terrain generation;
- Gaea/ProceduralTerrains integration;
- sculpting arbitrary heightfields;
- CSG/boolean union of road intersections;
- automatic vegetation scattering;
- automatic collision generation from visual meshes;
- runtime streaming changes;
- automatic optimization/decimation of arbitrary imported models;
- a generic node-based level editor;
- a new ECS;
- server/cloud storage for authoring sources.

Keep the tool narrow and deterministic.

## Repository layout

### Tracked tooling

```text
scripts/world-authoring/
├─ build.mjs
├─ scene-loader.mjs
├─ guide-parser.mjs
├─ geometry/
│  ├─ road-ribbon.mjs
│  ├─ road-ring.mjs
│  └─ river-ribbon.mjs
├─ export/
│  ├─ chunk-exporter.mjs
│  └─ gltf-node-compat.mjs        # only if GLTFExporter needs Node shims
├─ validation/
│  ├─ validate-scene.mjs
│  └─ build-report.mjs
└─ fixtures/
   └─ minimal-editor-scene.json

tools/world-authoring-viewer/
├─ index.html
├─ main.ts
├─ viewer.css
└─ vite.config.ts
```

Small reorganizations are acceptable if they improve cohesion, but keep authoring tooling outside runtime `src/game` / `src/rendering` code.

### Local-only source workspace

```text
authoring/local/
├─ three-editor/
│  └─ infuse-world.json
└─ assets/
   ├─ textures/
   └─ models/
```

Already gitignored. Do not remove this rule.

### Disposable generated output

```text
authoring/generated/
├─ preview/
│  └─ assembled-world.glb
├─ chunks/
│  ├─ areas/
│  └─ transitions/
├─ manifests/
│  └─ world-visual-manifest.json
└─ reports/
   └─ build-report.json
```

Already gitignored. `authoring:build` writes here only.

### Production output

`authoring:promote` writes the validated runtime assets to:

```text
public/assets/world/
├─ areas/
│  ├─ area-a01.glb
│  ├─ area-a02.glb
│  └─ area-a03.glb
├─ transitions/
│  ├─ transition-a01-a02-river.glb
│  └─ transition-a01-a03-ruined-wall.glb
└─ shared/
```

Do not promote source packs, unused textures, editor JSON, preview GLBs or diagnostics.

## Package scripts

Add focused scripts:

```json
{
  "authoring:build": "node scripts/world-authoring/build.mjs",
  "authoring:promote": "node scripts/world-authoring/build.mjs --promote",
  "authoring:validate": "node scripts/world-authoring/build.mjs --validate-only",
  "authoring:viewer": "vite --config tools/world-authoring-viewer/vite.config.ts"
}
```

Do not add a new heavy toolchain dependency unless the existing `three` + `vite` packages cannot perform the required export reliably.

## Input format support

The builder must accept the JSON produced by the current Three.js Editor.

Support both common shapes:

1. a full Editor project containing a scene field;
2. an exported Three.js scene/object JSON document.

Detection must be explicit and produce a useful error for unsupported input.

Prefer Three.js `ObjectLoader` for reconstructing the scene rather than hand-parsing every geometry/material type.

The builder must handle embedded image data if present in the Editor JSON. If the source contains unresolved external/blob URLs that cannot be loaded deterministically in Node, fail with a clear message identifying the texture/object rather than silently omitting it.

## Source scene contract

The source hierarchy follows `three-editor.md`.

Example:

```text
AUTHORING_WORLD
│
├─ Placement_A01
│  ├─ Area_A01_Root
│  │  ├─ Terrain
│  │  ├─ Vegetation
│  │  ├─ Rocks
│  │  ├─ Structures
│  │  └─ Props
│  ├─ AUTHORING_GUIDES
│  │  ├─ GUIDE_ROAD_Main
│  │  │  ├─ STYLE
│  │  │  ├─ P_001
│  │  │  ├─ P_002
│  │  │  └─ P_003
│  │  └─ GUIDE_ROAD_RING_Fountain
│  │     └─ STYLE
│  ├─ GAMEPLAY_GUIDES
│  ├─ REF_Playable_72x72
│  └─ REF_Visual_84x84
│
└─ Placement_Transition_A01_A02
   ├─ Transition_A01_A02_River
   ├─ AUTHORING_GUIDES
   │  └─ GUIDE_RIVER_Main
   │     ├─ STYLE
   │     ├─ P_001
   │     ├─ P_002
   │     └─ P_003
   └─ GAMEPLAY_GUIDES
```

## Naming contract

### Shipping roots

```text
Area_A<two-digit-id>_Root
Transition_A<id>_A<id>_<Theme>
```

Examples:

```text
Area_A01_Root
Area_A02_Root
Transition_A01_A02_River
Transition_A01_A03_RuinedWall
```

### Placement parents

```text
Placement_A01
Placement_A02
Placement_Transition_A01_A02
```

### Authoring guides

```text
GUIDE_ROAD_<id>
GUIDE_ROAD_RING_<id>
GUIDE_RIVER_<id>
```

### Path points

```text
P_001
P_002
P_003
...
```

Require zero-padded numeric suffixes and sort numerically. Reject duplicate point numbers.

### Generated objects

```text
GENERATED_ROAD_<id>
GENERATED_ROAD_RING_<id>
GENERATED_RIVER_<id>
```

Generated objects exist only in generated output.

## Ownership rules

A guide belongs to the placement group containing it.

- `GUIDE_ROAD_*` under `Placement_A01` generates into `Area_A01_Root`.
- `GUIDE_RIVER_*` under `Placement_Transition_A01_A02` generates into `Transition_A01_A02_River`.

Do not guess ownership from spatial overlap when hierarchy already defines it.

If a placement has multiple possible shipping roots, fail and require explicit hierarchy cleanup.

Manual production objects under a shipping root are preserved unchanged except for the transform rebasing required by chunk export.

## Transform contract

Authoring scene:

```text
Placement_A02           world position (6,0,-72)
└─ Area_A02_Root        local position (0,0,0)
```

Shipping GLB:

```text
Area_A02_Root           local position (0,0,0)
```

Runtime/world manifest owns `(6,0,-72)`.

The builder must validate before export that canonical shipping roots have:

```text
position = 0,0,0
rotation = 0,0,0
scale    = 1,1,1
```

Do not silently bake a bad shipping-root transform. Report it as an authoring error.

Guide points may be nested and transformed. Resolve their final world transforms, then convert them into the owning shipping root's local coordinate system before geometry generation.

## Guide STYLE contract

The user should not need to type numeric road widths into JSON.

Each road/river guide contains a simple mesh named `STYLE`.

For `GUIDE_ROAD_*` / `GUIDE_RIVER_*`:

- compute the STYLE mesh world-space XZ bounding box after transforms;
- the **smaller horizontal dimension** is the strip width;
- the **larger horizontal dimension** is the authored reference length used for UV scale;
- clone the STYLE material for the generated mesh;
- STYLE itself never ships.

Validate that width and reference length are finite and sensible (for example >0.05 m).

For `GUIDE_ROAD_RING_*`:

- STYLE should be a ring-like flat mesh centered on the desired landmark;
- derive inner/outer radii from the transformed XZ radial vertex distances around the guide origin;
- fail with a useful error if a reliable radius pair cannot be inferred.

Do not infer style from arbitrary unrelated objects.

## Road ribbon generation

Use Three.js curve/geometry primitives; do not introduce a generic geometry engine.

### Centerline

Given ordered `P_*` positions:

- require at least 2 points;
- build a `THREE.CatmullRomCurve3`;
- default to centripetal or chordal behavior if it produces more stable authored curves than uniform Catmull-Rom;
- preserve authored Y values so later roads can slope;
- sample approximately every 0.4-0.6 m, with sensible min/max segment clamps.

The exact curve type/tension must be centralized as builder constants, not scattered magic values.

### Ribbon vertices

For each sample:

1. evaluate center position;
2. evaluate tangent;
3. calculate horizontal perpendicular using world up `(0,1,0)`;
4. place left/right vertices at half width;
5. calculate normals/upward surface;
6. generate indexed triangles consistently.

Handle near-vertical/degenerate tangent cases defensively even though roads are expected to be mostly horizontal.

### Surface offset

Generated road surfaces may use a small fixed vertical offset, e.g. ~`0.02 m`, to sit above the rough base ground and avoid z-fighting.

Centralize this constant.

Do not continually increase offsets per rebuild.

### UVs

Textures must **tile along distance**, never stretch once across the entire road.

Use cumulative centerline distance for longitudinal UVs.

Preserve the physical visual scale implied by `STYLE`:

- transverse U spans the road width;
- longitudinal V increases with `distance / styleReferenceLength`;
- preserve texture repeat/wrapping configured on the cloned material.

Ensure texture wrapping is Repeat where needed without mutating unrelated source materials.

## Circular road generation

For `GUIDE_ROAD_RING_*`:

- generate a deterministic annular mesh with enough segments for a smooth game-camera silhouette;
- preserve STYLE material;
- generate tiled angular/radial UVs where practical;
- use the guide's world Y plus the standard road offset.

### Road/ring joins

Do **not** implement polygon CSG in v1.

Allow stable visual overlap between incoming road ribbons and the ring. If co-planar overlap causes z-fighting, use a tiny deterministic offset difference between ring and ribbon (for example 1 mm), documented in one constant.

Only add true geometric union/blending if real QA proves the overlap visible from the game camera.

## River ribbon generation

Use the same centerline/ribbon foundation as roads, with river-specific constants/material behavior.

V1 requirements:

- smooth centerline;
- width derived from STYLE;
- preserve authored Y;
- water material cloned from STYLE;
- tiled UVs;
- deterministic geometry;
- transition-local output when the guide belongs to a transition.

V1 does **not** need to automatically excavate banks or deform the ground.

Bridge alignment remains a manual composition responsibility. The viewer must make alignment easy to inspect.

## Manual production geometry

The builder must preserve manually authored objects under canonical shipping roots:

- ground planes;
- buildings;
- fountain;
- trees;
- rocks/cliffs;
- walls;
- bridge;
- props;
- manually authored production materials/textures.

Do not rename or reposition arbitrary manual production objects.

Do not convert visual meshes into gameplay collision automatically.

## Authoring-only objects to strip

Before any shipping export, recursively remove:

- `Placement_*` parents from the chunk payload;
- `AUTHORING_GUIDES`;
- `GAMEPLAY_GUIDES`;
- all `GUIDE_*` descendants;
- `REF_*` objects;
- editor cameras/helpers/lights that are not explicitly production-owned;
- `STYLE` and `P_*` guide children.

Production lights should require an explicit production naming/location convention rather than accidentally exporting editor lighting.

## Scene cloning / source safety

Never destructively modify the loaded source scene object and then reuse it for another chunk.

Recommended pattern:

1. load source scene once;
2. extract a normalized guide/placement model;
3. clone each shipping root for output;
4. add generated geometry to the clone;
5. strip authoring-only descendants from the clone;
6. export clone;
7. discard clone.

This prevents cross-chunk mutation and makes repeated builds deterministic.

## GLB export

Prefer the Three.js `GLTFExporter` already compatible with the project's Three.js version.

First implementation task should include a **small Node export spike** using the committed fixture.

If `GLTFExporter` requires browser APIs unavailable in the current Node runtime:

- add the smallest local compatibility shim needed (for example FileReader behavior);
- keep it isolated in `export/gltf-node-compat.mjs`;
- do not add a large exporter dependency before proving the built-in exporter cannot work cleanly.

Export binary GLB.

Default preference: embed textures/resources into each area/transition GLB where practical. This makes promotion simple and avoids accidentally shipping entire raw source packs.

Report duplication/file-size costs so this strategy can be revisited if repeated shared assets become too expensive.

## Preview assembly

`authoring:build` must generate:

```text
authoring/generated/preview/assembled-world.glb
```

This preview is assembled from the **same generated chunk clones that will be exported**, placed at their authoring world transforms.

Do not preview a separate code path that could hide chunk-export problems.

The preview must therefore reveal:

- chunk seams;
- incorrect placement transforms;
- generated road/ring/river joins;
- missing materials/textures;
- accidental guide objects;
- manual-asset placement errors.

## Build manifest

Generate:

```text
authoring/generated/manifests/world-visual-manifest.json
```

Suggested shape:

```json
{
  "source": {
    "path": "authoring/local/three-editor/infuse-world.json",
    "sha256": "..."
  },
  "builderVersion": 1,
  "chunks": [
    {
      "id": "A01",
      "kind": "area",
      "rootName": "Area_A01_Root",
      "worldPosition": [0, 0, 0],
      "output": "areas/area-a01.glb"
    }
  ],
  "guides": [
    {
      "type": "road",
      "id": "Main",
      "owner": "A01",
      "points": [[0, 0, 0], [5, 0, -3]]
    }
  ]
}
```

This manifest is local QA/build data in v1, not gameplay authority.

Do not silently update `src/data/areas/*.json` from it.

A later runtime-visual integration may deliberately promote a subset of this metadata into tracked rendering data after the world layout is accepted.

## Build report

Generate:

```text
authoring/generated/reports/build-report.json
```

Include at least:

- source hash;
- build timestamp for diagnostics (not used for geometry determinism);
- builder version;
- roots discovered;
- guide counts;
- generated vertex/triangle counts by object;
- output GLB byte sizes;
- texture/material counts;
- warnings;
- errors;
- stripped authoring-object counts;
- suspicious duplicate material/texture summary where feasible.

The CLI should also print a concise human-readable summary.

## Validation behavior

Treat structural problems as errors, not silent repairs.

Errors:

- missing expected source file;
- unsupported Editor JSON structure;
- duplicate canonical shipping root names;
- non-local shipping root transform;
- guide with missing STYLE;
- guide with <2 path points;
- duplicate/malformed `P_*` numbering;
- zero/invalid STYLE dimensions;
- unresolved required texture/image;
- failed GLB export;
- authoring-only object found in final chunk after stripping pass.

Warnings:

- unusually large GLB;
- unusually high triangle count;
- many unique textures/materials;
- repeated large assets across multiple chunks;
- road/river point spacing extremely uneven;
- road or river far outside expected visual bounds;
- production root contains suspicious editor camera/light/helper.

Keep thresholds centralized and easy to tune.

## Collider handling

V1 may parse and report `COLLIDER_*` boxes under `GAMEPLAY_GUIDES` so the viewer can display them.

Do not automatically overwrite gameplay collision JSON.

A later explicitly approved slice can add a collision extractor that validates and writes renderer-independent collision data.

## Local viewer

Create a **separate dev-only Vite viewer**, not a feature inside the production game UI.

Command:

```text
npm run authoring:viewer
```

The viewer reads the generated preview GLB and manifest from `authoring/generated/` using dev-only Vite filesystem access configured in `tools/world-authoring-viewer/vite.config.ts`.

Do not copy preview assets into normal `public/` just to make the viewer load them.

### Viewer minimum features

- load `assembled-world.glb`;
- clear loading/error state;
- orbit camera;
- top and isometric camera presets;
- reset/framing button;
- meter-scale grid;
- neutral lighting/background suitable for material inspection;
- toggle each area/transition chunk visibility;
- toggle generated roads/rivers visibility;
- optional guide centerline overlay using the generated manifest;
- optional collider overlay if collider metadata exists;
- show basic renderer stats / triangle count;
- show build warnings from `build-report.json`;
- manual `Reload generated world` button that cache-busts and reloads the latest files.

Do not turn this into a second editor. Editing remains in Three.js Editor.

### Viewer camera reference

Add an Infuse-like isometric/portrait inspection preset so the user can judge whether joins and silhouettes matter from the actual game presentation, not only from a close free camera.

The exact production camera values should be imported/reused where practical rather than duplicated if the existing rendering code exposes them cleanly. If reuse would couple the tools too tightly, document the temporary viewer preset separately.

## Promotion behavior

`npm run authoring:build` must never overwrite tracked shipping assets.

`npm run authoring:promote` may write `public/assets/world/**`, but only if:

1. structural validation passes;
2. every required chunk exports successfully;
3. no authoring-only object remains in shipping payloads.

Warnings do not necessarily block promotion, but must be printed prominently.

Promotion should copy from the freshly generated chunk output rather than rebuilding through a different code path.

Do not auto-commit from the builder.

## Licensing/provenance

The builder cannot infer third-party license rights from an image/model file.

Before committing promoted production outputs, the human/Codex workflow must verify that every third-party source embedded in the shipping result is represented in `ASSET-LICENSES.md`.

Do not keep full unused third-party source packs in Git merely for provenance; record the source URL/name/license in the tracked license document.

## Production payload discipline

Only `public/**` is relevant to the static runtime payload. Keeping authoring files outside `public/` avoids shipping them, but large files still damage Git history if committed.

Therefore:

- local Editor JSON: ignored;
- raw downloaded packs: ignored;
- generated previews/reports: ignored;
- final selected GLBs: tracked under `public/assets/world/`;
- exact standalone runtime textures/models: tracked only if a GLB does not embed them or runtime deliberately shares them.

The project still targets <500 MB overall and constrained/mobile hardware. Builder reporting must make asset growth visible early.

## Fixture strategy

Because real authoring input is gitignored, Codex Cloud must not depend on the user's private `infuse-world.json` to implement or validate the tool.

Commit a tiny fixture:

```text
scripts/world-authoring/fixtures/minimal-editor-scene.json
```

It should contain only lightweight primitives/materials and demonstrate:

- one `Placement_A01`;
- one `Area_A01_Root`;
- one manual ground object;
- one `GUIDE_ROAD_Test` with STYLE + at least 3 points;
- one `GUIDE_ROAD_RING_Test`;
- one transition with `GUIDE_RIVER_Test` if practical.

No external binary assets are needed.

`authoring:validate` should be able to run a fixture smoke test when the local source file is absent or when explicitly requested with `--fixture`.

## Implementation slices

### Slice 1 — loader + contract validation

Implement:

- source-path CLI;
- Editor JSON shape detection;
- ObjectLoader reconstruction;
- placement/root discovery;
- guide parsing;
- transform validation;
- fixture;
- basic report.

Acceptance:

- fixture loads deterministically;
- invalid names/transforms produce actionable errors;
- no runtime code changes.

### Slice 2 — road + ring geometry

Implement:

- STYLE extraction;
- path ordering;
- Catmull-Rom centerline;
- road ribbon;
- UV tiling;
- road ring;
- deterministic generated naming.

Acceptance:

- fixture produces visibly smooth road + ring;
- repeated runs produce identical geometry data for identical input;
- road texture does not stretch along full path.

### Slice 3 — river + chunk cloning/export

Implement:

- river ribbon;
- ownership mapping;
- cloned shipping roots;
- authoring-object strip pass;
- Node GLB exporter compatibility;
- independent area/transition GLBs;
- assembled preview GLB.

Acceptance:

- every shipping root exports local at identity transform;
- placement is visible only in assembled preview/world metadata;
- guide/reference objects are absent from GLB output.

### Slice 4 — viewer

Implement the standalone Vite viewer and generated-file loading.

Acceptance:

- one command opens the local viewer;
- area/transition toggles work;
- isometric/top framing works;
- build warnings/stats are visible;
- reload sees a newly generated preview without restarting the viewer where practical.

### Slice 5 — promotion + production diagnostics

Implement:

- `--promote` safety gates;
- final production paths;
- byte/triangle/material/texture reporting;
- clear provenance reminder;
- documentation finalization.

Acceptance:

- ordinary build cannot alter tracked runtime assets;
- promotion is explicit;
- promotion fails on structural errors;
- output paths match `three-editor.md`.

## Verification after implementation

Required commands:

```bash
npm install
npm run authoring:validate
npm run authoring:build -- --fixture
npm run build
```

Then run:

```bash
npm run authoring:viewer
```

and inspect the fixture/generated sample visually.

When the user has placed the real source JSON locally, additionally run:

```bash
npm run authoring:build
npm run authoring:viewer
```

Do not promote real assets until visual QA is acceptable.

After any code changes, `npm run build` is mandatory per `AGENTS.md`.

## Definition of done

The first production-ready version is complete when all of the following are true:

- the user can export one Three.js Editor JSON to the documented local path;
- the source JSON/raw packs remain outside Git and outside production payload;
- roads are authored with point markers, not manual curved meshes;
- fountain-ring roads are generated from a simple ring guide;
- rivers can be generated from point guides;
- manual art placement is preserved;
- the builder never rewrites source authoring JSON;
- generated objects are deterministic and clearly named;
- canonical area/transition roots export independently as local identity roots;
- authoring-only guides/helpers never ship;
- a single assembled preview is generated from the same chunk outputs;
- the local viewer makes chunk placement and generated geometry easy to inspect;
- ordinary builds are local/disposable;
- shipping asset promotion is explicit;
- production outputs live only under `public/assets/world/**`;
- asset/geometry/file-size diagnostics are visible before promotion;
- `npm run build` passes;
- documentation and `ASSET-LICENSES.md` expectations are clear.

## Future extensions — only after real need is proven

Possible later additions:

- bank generation around rivers;
- road shoulder/grass blend strips;
- polygon guides for irregular dirt/grass patches;
- automatic visual-to-collision suggestion (never direct authority);
- shared reusable prop/texture optimization across chunks;
- glTF compression/meshopt/KTX2 production step;
- large terrain-source adapter for Gaea/Blender/etc.;
- dedicated external/LFS versioning for creative source files;
- automated screenshot comparisons in the authoring viewer.

Do not implement these preemptively. First prove that the guide-driven road/river/chunk workflow materially reduces authoring effort on Areas 1-3.
