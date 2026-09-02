# Three.js Editor world-authoring quick start

Use this guide when replacing the current procedural/blockout environments with authored Three.js Editor scenes.

The preferred workflow is now **guide-driven authoring**, not terrain generation. Areas 1-3 are small authored RPG levels; do not force Gaea or another terrain generator into the pipeline unless a later region has a clear need for large natural terrain.

## Preferred production workflow

```text
THREE.JS EDITOR
rough ground + guide objects + manually placed art
        ↓
export local Editor JSON
        ↓
CODEX WORLD-AUTHORING BUILDER
smooth roads/rivers + clean hierarchy + chunk export + validation
        ↓
local authoring viewer
        ↓
visual QA
        ↓
production Area_* / Transition_* GLBs
        ↓
Infuse runtime QA
```

The division of responsibility is deliberate:

- **User / Three.js Editor:** composition, proportions, asset choice, object placement, path intent, environmental storytelling.
- **Builder:** repetitive geometry work, smooth curves, UVs, generated surfaces, naming validation, chunk-local transforms, export and diagnostics.
- **Infuse runtime:** gameplay state, collision authority, streaming and world placement.

Do not spend authoring time making a road curve perfect by hand when a few guide points can express the same intent.

## Core rules

- 1 Three.js / Infuse unit = 1 meter.
- +X = east, **-Z = north**, +Y = up.
- World placement belongs to authoring `Placement_*` parents or generated runtime visual metadata.
- Every independently shipped `Area_*_Root` / `Transition_*` root stays local at `(0,0,0)`, zero rotation, unit scale.
- Visual meshes are never gameplay-collision authority.
- `GUIDE_*`, `REF_*`, `Placement_*` and other authoring-only objects never ship.
- The builder never rewrites the user's source Editor JSON.
- Generated geometry is deterministic: same source JSON + same builder version/config = same output.

## Authoring files and Git policy

Use this exact local workspace:

```text
authoring/local/
├─ three-editor/
│  └─ infuse-world.json
└─ assets/
   ├─ textures/
   └─ models/
```

`authoring/local/` is ignored by Git.

This is intentional. Three.js Editor source JSON can become large as scene assets are serialized, and downloaded texture/model packs usually contain many unused files. Keep the creative source locally and back it up outside normal Git if needed.

The builder writes disposable files to:

```text
authoring/generated/
```

This directory is also ignored.

Only final game assets belong in Git under:

```text
public/assets/world/
├─ areas/
├─ transitions/
└─ shared/
```

Do not copy entire source packs into `public/`. Promote only the exact files needed at runtime. Prefer self-contained GLBs where practical so unused source textures/models do not leak into the production payload.

Every third-party texture/model that reaches the shipped game, including assets embedded in a GLB, must be documented in `ASSET-LICENSES.md`.

See `authoring/README.md` for the storage policy.

## Target world layout

Every area has a playable envelope plus a nominal 6 m visual apron on each side.

| Area | Theme / role | Playable target | Visual target | Local playable bounds | Local visual bounds | Proposed world root |
| --- | --- | --- | --- | --- | --- | --- |
| Area 1 | meadow / hub | **72 × 72 m** | **84 × 84 m** | X `-36..36`, Z `-36..36` | X `-42..42`, Z `-42..42` | `(0, 0, 0)` |
| Area 2 | darker ashwood / river frontage | **144 × 48 m** | **156 × 60 m** | X `-75..75`, Z `-24..24` | X `-81..81`, Z `-30..30` | `(36, 0, -60)` |
| Area 3 | ruined fortress | **72 × 72 m** | **84 × 84 m** | X `-36..36`, Z `-36..36` | X `-42..42`, Z `-42..42` | `(72, 0, 0)` |

Area 1 is the scale anchor. Area 2's west playable edge aligns with Area 1's west playable edge, and its south playable edge meets the north playable edges of Areas 1 and 3. Area 3's west playable edge meets Area 1's east playable edge. This produces a connected L-shaped playable layout with no gaps.

The visual envelopes intentionally overlap. Do **not** add another 12 m empty gap between neighboring playable areas.

## Shared transition convention

Canonical root naming:

```text
Transition_A<lower-id>_A<higher-id>_<Theme>
```

### Area 1 ↔ Area 2 — river

```text
Transition_A01_A02_River
transition-a01-a02-river.glb
world placement: (0,0,-36)
nominal overlap: X -42..42, Z -42..-30
local band:      X -42..42, Z -6..6
```

The transition owns shared water, bridge/causeway, seam rocks, shared bank props/effects, and generated river geometry that belongs to the seam.

### Area 1 ↔ Area 3 — ruined wall

```text
Transition_A01_A03_RuinedWall
transition-a01-a03-ruined-wall.glb
world placement: (36,0,0)
nominal overlap: X 30..42, Z -42..42
local band:      X -6..6, Z -42..42
```

The transition owns shared wall/gate/rubble/seam props.

### Area 2 ↔ Area 3

Keep the theme open until those two areas are authored:

```text
Transition_A02_A03_<Theme>
```

## Three.js Editor master scene

Use one assembled scene so neighboring areas and transitions can be authored in context.

Recommended hierarchy:

```text
AUTHORING_WORLD
│
├─ Placement_A01                         world (0,0,0)
│  ├─ Area_A01_Root                      local (0,0,0)
│  │  ├─ Terrain
│  │  ├─ Vegetation
│  │  ├─ Rocks
│  │  ├─ Structures
│  │  └─ Props
│  ├─ AUTHORING_GUIDES
│  ├─ GAMEPLAY_GUIDES
│  ├─ REF_Playable_72x72
│  └─ REF_Visual_84x84
│
├─ Placement_Transition_A01_A02          world (0,0,-36)
│  ├─ Transition_A01_A02_River           local (0,0,0)
│  │  ├─ Water
│  │  ├─ Bridge
│  │  ├─ Rocks
│  │  └─ RiverVegetation
│  ├─ AUTHORING_GUIDES
│  ├─ GAMEPLAY_GUIDES
│  └─ REF_Transition_84x12
│
├─ Placement_A02                         world (39,0,-60)
│  ├─ Area_A02_Root                      local (0,0,0)
│  ├─ AUTHORING_GUIDES
│  ├─ GAMEPLAY_GUIDES
│  ├─ REF_Playable_150x48
│  └─ REF_Visual_162x60
│
├─ Placement_Transition_A01_A03          world (36,0,0)
│  ├─ Transition_A01_A03_RuinedWall      local (0,0,0)
│  ├─ AUTHORING_GUIDES
│  ├─ GAMEPLAY_GUIDES
│  └─ REF_Transition_12x84
│
└─ Placement_A03                         world (72,0,0)
   ├─ Area_A03_Root                      local (0,0,0)
   ├─ AUTHORING_GUIDES
   ├─ GAMEPLAY_GUIDES
   ├─ REF_Playable_72x72
   └─ REF_Visual_84x84
```

Only canonical `Area_*_Root` / `Transition_*` roots and their production visual descendants become runtime GLBs.

### Placement parent vs shipping root

Mandatory:

```text
Placement_A02           position (39,0,-60)
└─ Area_A02_Root        position (0,0,0)
```

and:

```text
Placement_Transition_A01_A02     position (0,0,-36)
└─ Transition_A01_A02_River      position (0,0,0)
```

Never bake the placement-parent world offset into the shipping root.

## Start with simple ground, not generated terrain

For Area 1, start with an exact-size ground plane:

```text
Ground_Grass
PlaneGeometry 84 × 84 m
```

The central meadow can remain simple. Add natural shape only where it creates visible value: west cliffs/elevation, south rift, north river transition, east ruined-wall transition.

Do not introduce a terrain generator just to create small height variation. If later testing proves that a specific region needs real heightfield terrain, add that as a specialized source workflow rather than making it mandatory for every area.

## AUTHORING_GUIDES: express intent, not final geometry

The builder interprets authoring guides and creates clean production geometry.

### Roads

Create a group:

```text
GUIDE_ROAD_<id>
├─ STYLE
├─ P_001
├─ P_002
├─ P_003
└─ ...
```

Rules:

- `P_*` objects are simple marker meshes placed along the desired road centerline.
- Numeric order defines path order.
- Markers can be ugly spheres/cylinders; only their transforms matter.
- `STYLE` is a simple flat road sample that communicates desired width/material. It does not ship.
- The builder samples a smooth curve through the points and generates a road ribbon with tiled UVs.

You should spend time deciding **where the road goes**, not drawing curved road polygons.

### Circular road around a fountain

Use:

```text
GUIDE_ROAD_RING_<id>
└─ STYLE
```

Place the guide at the fountain center and scale its geometry/radius to show the desired ring. The builder generates a clean annular road and blends/overlaps incoming road ribbons with a tiny deterministic vertical bias where required to avoid z-fighting.

For the first implementation, visual overlap at joins is acceptable if it is stable and invisible from the game camera. Do not add CSG complexity unless QA proves it necessary.

### Rivers

Create:

```text
GUIDE_RIVER_<id>
├─ STYLE
├─ P_001
├─ P_002
├─ P_003
└─ ...
```

`STYLE` communicates approximate width/material. The builder creates a smooth ribbon/water surface from the path. Bank meshes or detailed terrain deformation are optional later extensions; do not block the first useful builder on them.

### Other irregular surfaces

If a future need cannot be expressed cleanly with a road/river spline, add a new explicit guide type rather than abusing arbitrary mesh names. Keep guide semantics deterministic and documented.

## Manual assets remain manual

These stay under the production roots and are preserved by the builder:

- buildings;
- fountain;
- trees and vegetation groups;
- rocks/cliff assets;
- ruined walls;
- bridge models;
- lamps, signs and storytelling props.

The builder must not move or rewrite arbitrary manually placed production assets.

Useful ownership rule: if an object must remain identical while either side of a seam is loaded, the transition probably owns it.

## Generated-object ownership

The builder creates generated visual objects with a `GENERATED_*` prefix, for example:

```text
GENERATED_ROAD_Main
GENERATED_ROAD_RING_Fountain
GENERATED_RIVER_A01A02
```

These exist only in generated output, never as hand-maintained source objects.

The source JSON remains:

```text
manual production objects
+ GUIDE_*
+ REF_*
+ Placement_*
```

The generated scene becomes:

```text
manual production objects
+ GENERATED_*
```

and strips the authoring-only objects before shipping export.

## Collision authoring workflow

Three.js Editor is the authoring UI for collision placement, not the runtime collision engine.

Current Infuse collision is axis-aligned rectangles:

```text
id + x + z + width + depth
```

Use editor-only translucent/wireframe boxes:

```text
GAMEPLAY_GUIDES
├─ COLLIDER_RiverWest
├─ COLLIDER_RiverEast
├─ COLLIDER_House_01
└─ COLLIDER_WestCliff_01
```

Until runtime collision explicitly supports rotation, keep these boxes unrotated. Approximate diagonal blockers with several rectangles if necessary.

The builder may validate/extract collider transforms, but generated visual meshes never become collision authority automatically.

### River + bridge

Block the river, not the bridge:

```text
   COLLIDER_RiverWest       COLLIDER_RiverEast
   ┌─────────────────┐      ┌─────────────────┐
~~~│~~~~~~~~~~~~~~~~~│bridge│~~~~~~~~~~~~~~~~~│~~~
   └─────────────────┘  │   └─────────────────┘
                         │
                    walkable opening
```

Leave forgiving clearance for mobile movement.

## Builder outputs

The planned tool is defined in `6-world-authoring-builder.md`.

Default local input:

```text
authoring/local/three-editor/infuse-world.json
```

Disposable outputs:

```text
authoring/generated/
├─ preview/
│  └─ assembled-world.glb
├─ reports/
│  └─ build-report.json
└─ manifests/
   └─ world-visual-manifest.json
```

Production outputs after explicit build/promotion:

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

Never ship the combined `AUTHORING_WORLD` as one runtime GLB.

## Independent visual export requirements

The builder must:

- find canonical `Area_*_Root` / `Transition_*` roots;
- preserve manual production visuals;
- generate supported `GUIDE_*` geometry;
- exclude `Placement_*`, `AUTHORING_GUIDES`, `GAMEPLAY_GUIDES`, `GUIDE_*`, `REF_*` and editor helpers from GLBs;
- preserve each shipping root at local `(0,0,0)`, zero rotation, unit scale;
- export each area/transition independently;
- report missing/duplicate roots, bad naming, invalid transforms and suspicious asset sizes;
- produce a local assembled preview for QA.

Do not repeatedly move roots between local and world positions to export manually.

## Shipping QA

Reassemble **exported chunks**, not source editor objects, at runtime transforms:

```text
Area_A01_Root                  (0,0,0)
Area_A02_Root                  (39,0,-60)
Area_A03_Root                  (72,0,0)
Transition_A01_A02_River       (0,0,-36)
Transition_A01_A03_RuinedWall  (36,0,0)
```

Check:

- generated roads are smooth and their textures tile rather than stretch;
- fountain ring and incoming paths look natural at game-camera distance;
- river, bridge and banks align;
- no z-fighting is visible;
- no authoring guide/reference/helper ships;
- no placement-parent transform is baked into a GLB;
- collision still matches visible blockers;
- visual aprons hide loading boundaries from the portrait camera;
- repeated assets/materials have not caused unreasonable file-size growth;
- Full/Reduced graphics modes remain within mobile performance targets.

## Optional terrain-generator escape hatch

Gaea, ProceduralTerrains or Blender terrain workflows are **optional specialist inputs**, not the default Area 1-3 workflow.

Use one only when the desired environment genuinely requires terrain that is difficult to express through simple ground + placed cliff/rock assets + guide-generated surfaces. If introduced later, its output should enter the same builder/chunk/export pipeline rather than creating a second runtime convention.

## Quick reference

```text
Axes:       +X east, -Z north, +Y up
Units:      1 unit = 1 meter
Apron:      nominal 6 m per visual side

Area 1:     playable 72×72, visual 84×84, root world (0,0,0)
Area 2:     playable 150×48, visual 162×60, root world (39,0,-60)
Area 3:     playable 72×72, visual 84×84, root world (72,0,0)

A1/A2:      Transition_A01_A02_River
            world placement (0,0,-36)

A1/A3:      Transition_A01_A03_RuinedWall
            world placement (36,0,0)

Editor source:          authoring/local/three-editor/infuse-world.json
Source asset packs:     authoring/local/assets/**
Generated previews:     authoring/generated/**
Shipping world assets:  public/assets/world/**

Editor responsibility: composition + guides + manual asset placement
Builder responsibility: generated geometry + validation + chunk export
Runtime responsibility: world placement + streaming + gameplay authority

World editor offset:    Placement_* parent
Shipping visual root:   ALWAYS local (0,0,0)
Road guides:            GUIDE_ROAD_* / P_###
Road rings:             GUIDE_ROAD_RING_*
River guides:           GUIDE_RIVER_* / P_###
Collision authoring:    GAMEPLAY_GUIDES / COLLIDER_* boxes
Generated visuals:      GENERATED_*
```
