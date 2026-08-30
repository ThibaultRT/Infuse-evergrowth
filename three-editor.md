# Three.js Editor / Gaea world-authoring quick start

Use this guide when replacing the current procedural/blockout environments with authored Gaea + Three.js Editor scenes.

Preferred production workflow:

```text
ONE GAEA MASTER REGION
        ↓
deterministic terrain slicing
        ↓
ONE THREE.JS MASTER AUTHORING SCENE
        ↓
edit areas + shared transitions + gameplay guides in context
        ↓
export each Area_* / Transition_* shipping root independently
        ↓
extract/update lightweight gameplay collision data
        ↓
re-import exported chunks / load them in Infuse for QA
```

Core rules:

- 1 Gaea / Three.js / Infuse unit = 1 meter.
- +X = east, **-Z = north**, +Y = up.
- World placement belongs to authoring `Placement_*` parents or Infuse runtime metadata.
- Every independently shipped `Area_*_Root` / `Transition_*` root stays local at `(0,0,0)`, zero rotation, unit scale.
- Visual meshes are never gameplay-collision authority.
- Terrain should be generated continuously before it is split; runtime terrain chunks must not duplicate the same surface.

## Target world layout

Every area has a playable envelope plus a nominal 6 m visual apron on each side.

| Area | Theme / role | Playable target | Visual target | Local playable bounds | Local visual bounds | Proposed world root |
| --- | --- | --- | --- | --- | --- | --- |
| Area 1 | meadow / hub | **72 × 72 m** | **84 × 84 m** | X `-36..36`, Z `-36..36` | X `-42..42`, Z `-42..42` | `(0, 0, 0)` |
| Area 2 | darker ashwood / river frontage | **84 × 72 m** | **96 × 84 m** | X `-42..42`, Z `-36..36` | X `-48..48`, Z `-42..42` | **target estimate** `(6, 0, -72)` |
| Area 3 | ruined fortress | **84 × 72 m** | **96 × 84 m** | X `-42..42`, Z `-36..36` | X `-48..48`, Z `-42..42` | **target estimate** `(78, 0, 0)` |

Area 1 is the agreed scale anchor. Area 2/3 are production-start estimates derived from the accepted visualization and current gameplay proportions; validate them before detailed art production.

World-space envelopes:

| Area | Playable X | Playable Z | Visual X | Visual Z |
| --- | ---: | ---: | ---: | ---: |
| Area 1 | `-36..36` | `-36..36` | `-42..42` | `-42..42` |
| Area 2 | `-36..48` | `-108..-36` | `-42..54` | `-114..-30` |
| Area 3 | `36..120` | `-36..36` | `30..126` | `-42..42` |

The visual envelopes intentionally overlap. Do **not** add another 12 m empty gap between neighboring playable areas.

## Shared transition convention

Canonical root naming:

```text
Transition_A<lower-id>_A<higher-id>_<Theme>
```

Suggested GLB names use the same identity in kebab case.

### Area 1 ↔ Area 2 — river

```text
Transition_A01_A02_River
transition-a01-a02-river.glb
world placement: (0,0,-36)
nominal overlap: X -42..42, Z -42..-30
local band:      X -42..42, Z -6..6
```

The transition owns shared water, bridge/causeway, seam rocks, shared bank props/effects and any terrain strip assigned to the river transition.

### Area 1 ↔ Area 3 — ruined wall

```text
Transition_A01_A03_RuinedWall
transition-a01-a03-ruined-wall.glb
world placement: (36,0,0)
nominal overlap: X 30..42, Z -42..42
local band:      X -6..6, Z -42..42
```

The transition owns shared wall/gate/rubble/seam props. It may also own a terrain strip if the terrain partition requires one, but the visual identity is the ruined wall rather than the ground itself.

### Area 2 ↔ Area 3

Keep the production theme/name open until those two areas are authored. Use:

```text
Transition_A02_A03_<Theme>
```

when decided.

## Gaea recommendation: one continuous master region

Prefer **one large continuous Gaea source terrain for the current coherent world region**, not one unrelated Gaea project per area.

Why:

- elevation is continuous across seams;
- erosion and drainage stay coherent;
- rivers/canyons naturally cross chunk boundaries;
- shared water levels use one Y datum;
- you avoid manually matching independently generated edge heights.

For the current three-area layout, the combined visual bounds already span approximately:

```text
world X = -42 .. 126
world Z = -114 .. 42
```

The Gaea master may extend beyond those values for useful scenery margin. Do not make the entire hypothetical future 15-area world today; expand this master region later or create another regional master when required.

### Gaea source vs shipping chunks

The Gaea project is **source art**, not a runtime chunk.

Conceptually:

```text
GAEA_MASTER_REGION
        │
        ├─ crop/partition → terrain for Area A01
        ├─ crop/partition → terrain for Transition A01/A02 River
        ├─ crop/partition → terrain for Area A02
        ├─ crop/partition → terrain for Transition A01/A03 if needed
        └─ crop/partition → terrain for Area A03
```

Do not independently regenerate those pieces in Gaea after the master terrain is accepted. They should all derive from the same source heightfield/mesh so seam elevations remain identical.

### Terrain ownership: no duplicate surfaces

The **visual envelopes may overlap, but shipping terrain surfaces should not**.

If a transition owns terrain, neighboring area terrain must stop at that transition-owned strip. Example for the river:

```text
Area 2 terrain
───────────────
River transition terrain
───────────────
Area 1 terrain
```

Do not ship Area 1 terrain + river terrain + Area 2 terrain all occupying the same coincident 12 m surface; that wastes GPU work and risks z-fighting.

A transition does not have to own terrain merely because it owns visual props. The deterministic terrain partition decides ownership. For example, the ruined-wall transition may use a small shared ground strip if useful, or the terrain may split at a clean seam beneath the wall. Either way, every world-space terrain surface has exactly one runtime owner.

## Recommended Codex terrain-slicing tool

Once the first useful Gaea master export exists, build a small deterministic **terrain slicer** rather than manually cutting terrain for every area.

This is a production-authoring tool, **not part of the `5-area-streaming.md` implementation slice**. Implement streaming first; add the slicer when integrating the first real Gaea terrain.

### Single source of truth

Do not hardcode the area coordinates again inside the slicer.

When production dimensions/origins are accepted, Codex should centralize them in stable authored world/layout data and have both runtime placement and authoring tools consume that data.

Current `src/data/areas/area-*.json` still contains the old blockout sizes/origins. Therefore the slicer must **not** blindly use those values until the production layout is intentionally migrated.

Recommended split of authority:

- gameplay area origin/playable size: renderer-independent authored area data;
- visual apron, GLB provider and terrain-crop/transition ownership: focused rendering/authoring manifest;
- transition identity/connectivity: existing authored connection IDs plus focused visual metadata where needed.

The exact filename can be chosen during implementation, but there must be one authoritative layout contract rather than copies in `three-editor.md`, runtime code and scripts.

### Inputs

The tool should consume:

```text
master Gaea terrain export
+ master world bounds / scale metadata
+ authoritative area/transition layout manifest
```

The master terrain source may be a mesh/GLB or a high-quality heightfield pipeline, depending on which proves more reliable. Preserve enough source metadata to map every sample/vertex back to world X/Z deterministically.

### Outputs

Generate chunk-local terrain assets such as:

```text
terrain-a01.glb
terrain-transition-a01-a02-river.glb
terrain-a02.glb
terrain-a03.glb
```

Only generate a transition-terrain asset when that transition actually owns a terrain strip.

Each result must be rebased so its shipping root is local `(0,0,0)` and Infuse applies the documented world placement externally.

### Required slicer behavior

The tool should:

1. Read chunk bounds from the authoritative layout instead of magic numbers.
2. Partition/crop the master terrain into non-overlapping runtime ownership regions.
3. Preserve exact shared-edge height samples/vertices so adjacent chunks cannot develop cracks.
4. Keep the common world Y datum; never independently normalize each chunk vertically.
5. Rebase X/Z into each chunk's local coordinate system after cutting.
6. Validate that terrain ownership has no unintended gaps or coincident duplicate surfaces.
7. Emit useful diagnostics for chunk bounds, vertex counts and seam ownership.
8. Be deterministic: rerunning it from the same master source + manifest produces the same chunk geometry.

If source textures/material maps are global, the first proof may keep them simple. For true long-term streaming efficiency, the toolchain should eventually crop/remap large terrain texture maps per chunk or use another deliberate shared-texture strategy; do not unknowingly make every small terrain chunk retain a unique copy of one giant texture.

### Why automate this

The desired iteration becomes:

```text
edit ONE Gaea master region
        ↓
export master terrain
        ↓
run terrain slicer
        ↓
all area/transition terrain chunks regenerated at correct bounds
        ↓
Three.js master scene / Infuse QA
```

That avoids manually re-cutting Area 1, river, Area 2, etc. every time the master terrain changes.

## Three.js Editor: one master authoring scene

Use one assembled editor scene for day-to-day environment work. This lets you edit the river while seeing both banks and edit the ruined wall while seeing both neighboring areas.

Recommended hierarchy:

```text
AUTHORING_WORLD
│
├─ Placement_A01                       world (0,0,0)
│  ├─ Area_A01_Root                    local (0,0,0)
│  │  ├─ Terrain
│  │  ├─ Vegetation
│  │  ├─ Rocks
│  │  ├─ Structures
│  │  └─ Props
│  ├─ GAMEPLAY_GUIDES
│  ├─ REF_Playable_72x72
│  └─ REF_Visual_84x84
│
├─ Placement_Transition_A01_A02        world (0,0,-36)
│  ├─ Transition_A01_A02_River         local (0,0,0)
│  │  ├─ Terrain        optional/owned strip from Gaea slicer
│  │  ├─ Water
│  │  ├─ Bridge
│  │  ├─ Rocks
│  │  └─ RiverVegetation
│  ├─ GAMEPLAY_GUIDES
│  └─ REF_Transition_84x12
│
├─ Placement_A02                       world (6,0,-72)
│  ├─ Area_A02_Root                    local (0,0,0)
│  ├─ GAMEPLAY_GUIDES
│  ├─ REF_Playable_84x72
│  └─ REF_Visual_96x84
│
├─ Placement_Transition_A01_A03        world (36,0,0)
│  ├─ Transition_A01_A03_RuinedWall    local (0,0,0)
│  ├─ GAMEPLAY_GUIDES
│  └─ REF_Transition_12x84
│
└─ Placement_A03                       world (78,0,0)
   ├─ Area_A03_Root                    local (0,0,0)
   ├─ GAMEPLAY_GUIDES
   ├─ REF_Playable_84x72
   └─ REF_Visual_96x84
```

`Placement_*`, `GAMEPLAY_GUIDES` and `REF_*` are authoring structures. Only canonical `Area_*_Root` / `Transition_*` roots and their visual descendants become runtime GLBs.

### Placement parent vs shipping root

Mandatory rule:

```text
Placement_A02           position (6,0,-72)
└─ Area_A02_Root        position (0,0,0)
```

and:

```text
Placement_Transition_A01_A02     position (0,0,-36)
└─ Transition_A01_A02_River      position (0,0,0)
```

Never bake the placement-parent world offset into the shipping root.

### Ownership while editing

Even though all chunks are visible together, ownership stays strict:

- unique Area 1 scenery → `Area_A01_Root`;
- shared river scenery → `Transition_A01_A02_River`;
- shared ruined-wall scenery → `Transition_A01_A03_RuinedWall`;
- collision helpers → sibling `GAMEPLAY_GUIDES` of their owning placement group.

Useful rule: if an object must remain identical while either side of a seam is loaded, the transition probably owns it.

## Collision authoring workflow

Three.js Editor is the **authoring UI** for collision placement, not the runtime collision engine.

The current Infuse collision type is axis-aligned rectangles:

```text
id + x + z + width + depth
```

Use editor-only translucent/wireframe BoxGeometry helpers:

```text
GAMEPLAY_GUIDES
├─ COLLIDER_RiverWest
├─ COLLIDER_RiverEast
├─ COLLIDER_House_01
└─ COLLIDER_WestCliff_01
```

Until runtime collision explicitly supports rotation, keep these boxes unrotated. Approximate diagonal walls/cliffs with several rectangles if needed.

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

Leave forgiving clearance around the bridge for mobile movement. Do not over-collide decorative details.

Area-local blockers conceptually belong to that area's gameplay data. Shared seam blockers conceptually belong to the connection/transition. The generated runtime collision remains lightweight and loaded even when its visual GLB is not resident.

A future exporter should validate `COLLIDER_*` IDs/transforms and generate/update renderer-independent collision data. For the first small production proof, a few values may be transferred manually; do not scale that manual process to many colliders.

## Independent visual export

The master editor scene must produce independent runtime chunks, for example:

```text
area-a01.glb
transition-a01-a02-river.glb
area-a02.glb
transition-a01-a03-ruined-wall.glb
area-a03.glb
```

Never ship the combined `AUTHORING_WORLD` as one runtime GLB.

After the first production proof, Codex should provide a deterministic authoring/export tool that:

- finds canonical `Area_*_Root` / `Transition_*` roots;
- excludes `Placement_*`, `GAMEPLAY_GUIDES`, `REF_*` and unrelated chunks;
- preserves each shipping root at local `(0,0,0)`, zero rotation, unit scale;
- exports each root independently;
- optionally invokes/coordinates the collision extractor and Gaea terrain slicer as one repeatable authoring build.

Do not repeatedly move roots between local and world positions to export them manually.

## Shipping QA

After export, assemble the **exported chunks**, not the master editor objects, at their runtime transforms:

```text
Area_A01_Root                  (0,0,0)
Area_A02_Root                  (6,0,-72)
Area_A03_Root                  (78,0,0)
Transition_A01_A02_River       (0,0,-36)
Transition_A01_A03_RuinedWall  (36,0,0)
```

Check:

- terrain seams have no cracks, gaps or z-fighting;
- Y/elevation continuity is preserved;
- river banks and bridge align;
- ruined wall/gate/rubble align;
- no authoring world transform was baked into a GLB;
- collision matches visible blockers and leaves bridge/gate openings walkable;
- visual aprons hide loading boundaries from the actual portrait camera.

The clean re-import/Infuse assembly is QA, not the normal editing workflow.

## Runtime implications for Codex

When production visuals replace blockouts, runtime needs explicit visual metadata for both area and transition chunks. Do not derive placement from GLB contents.

At minimum:

```text
AREA
id
world root
playable width/depth
visual width/depth
provider / GLB URL
shared transition IDs

TRANSITION
connection id
connected area IDs
world root
provider / GLB URL
optional terrain ownership/crop metadata
```

Gameplay JSON/world data remains authoritative for collisions, spawns, gates and progression. Visual metadata remains a rendering/authoring concern. The terrain slicer and Three.js exporter should consume the same accepted layout data used by runtime rather than maintaining separate coordinates.

`5-area-streaming.md` defines runtime residency. The terrain slicer/export tooling belongs to the later production-authoring integration, after streaming is proven.

## Quick reference

```text
Axes:       +X east, -Z north, +Y up
Units:      1 unit = 1 meter
Apron:      nominal 6 m per visual side

Area 1:     playable 72×72, visual 84×84, root world (0,0,0)
Area 2:     playable 84×72, visual 96×84, root target (6,0,-72)
Area 3:     playable 84×72, visual 96×84, root target (78,0,0)

A1/A2:      Transition_A01_A02_River
            seam Z=-36, nominal overlap 84×12
            world placement (0,0,-36)

A1/A3:      Transition_A01_A03_RuinedWall
            seam X=36, nominal overlap 12×84
            world placement (36,0,0)

Terrain source:         one continuous Gaea master region
Terrain runtime:        deterministic non-overlapping area/transition slices
Terrain slicer:         reads authoritative world/layout metadata, no magic coordinates
Editor source:          one assembled Three.js MASTER scene
World editor offset:    Placement_* parent
Shipping visual root:   ALWAYS local (0,0,0)
Collision authoring:    GAMEPLAY_GUIDES / COLLIDER_* boxes
Collision runtime:      renderer-independent, never streamed with visuals
Final QA:               exported chunks reassembled in Infuse / clean preview
```
