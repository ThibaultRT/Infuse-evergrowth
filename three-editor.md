# Three.js Editor / Gaea world-authoring quick start

Use this guide when replacing the current procedural/blockout environments with authored Gaea + Three.js Editor scenes.

The preferred workflow is:

```text
one assembled MASTER AUTHORING scene
        ↓
edit areas + shared transitions + gameplay guides in context
        ↓
export each Area_* / Transition_* shipping root independently
        ↓
extract/update lightweight gameplay collision data from guides
        ↓
re-import exported GLBs / load them in Infuse for final QA
```

The most important rule is: **world placement belongs to an authoring placement parent or to Infuse; every shipping root stays local at `(0,0,0)`.** Do not bake the global world offset into an area or transition GLB.

Gameplay collision is a second, equally important rule: **visual meshes are never collision authority.** Three.js Editor may be used to place editor-only collision guides, but Infuse consumes simple renderer-independent gameplay shapes derived from those guides.

These dimensions/origins are production-authoring targets inferred from the accepted world visualization and current area proportions. Area 1 is the agreed anchor. Area 2/3 values are target estimates until their production scenes are validated in-game.

## Coordinate convention

Infuse currently places Area 2 north of Area 1 at a negative Z world origin, so preserve the existing runtime convention:

- 1 Three.js Editor/Gaea unit = 1 meter.
- X = east/west ground axis.
- +X = east.
- Z = north/south ground axis.
- **-Z = north**, +Z = south.
- Y = elevation/up.
- Shipping roots use scale `(1, 1, 1)` and zero rotation.
- Keep a common Y datum across areas. Do not independently re-zero terrain vertically in a way that makes shared water/banks/walls jump at a seam.

The current runtime area origins are still the old blockout values. Do not treat them as final production positions. When authored areas start replacing the blockouts, Codex should deliberately update rendering/world-placement data to the targets below rather than silently fitting the new GLBs to the old dimensions.

## Target area sizes

Every area has a **playable envelope** plus a 6 m visual apron on each side. Therefore the visual envelope is 12 m larger than the playable envelope on each axis.

| Area | Theme / role | Playable target | Visual / Gaea target | Local playable bounds | Local visual bounds | Proposed world root |
| --- | --- | --- | --- | --- | --- | --- |
| Area 1 | meadow / hub | **72 × 72 m** | **84 × 84 m** | X `-36..36`, Z `-36..36` | X `-42..42`, Z `-42..42` | `(0, 0, 0)` |
| Area 2 | darker ashwood / river frontage | **84 × 72 m** | **96 × 84 m** | X `-42..42`, Z `-36..36` | X `-48..48`, Z `-42..42` | **target estimate** `(6, 0, -72)` |
| Area 3 | ruined fortress | **84 × 72 m** | **96 × 84 m** | X `-42..42`, Z `-36..36` | X `-48..48`, Z `-42..42` | **target estimate** `(78, 0, 0)` |

### Why 84 × 72 for Areas 2 and 3?

Area 1 is intentionally growing from the current 36 × 56 blockout to 72 × 72.

The accepted visualization depicts Area 2 as broader east/west than Area 1 but with a similar north/south travel depth. The current authored data already reflects this: Area 2 is 76 × 56. A clean **84 × 72** target keeps that character while giving the new terrain more room.

Area 3 currently measures 40 × 56, close to Area 1's old 36 × 56 footprint. Scaling it by roughly the same amount as the new Area 1 gives about 80 × 72; **84 × 72** is a clean editor-friendly target and gives the ruined fortress slightly more lateral room than Area 1.

Do not increase these further just to fill the concept image. Start here, inspect the portrait camera and gameplay density, and only enlarge before production detailing if the real scene proves cramped.

## Proposed world layout

The proposed roots preserve the current triangular topology while making the new rectangles meet exactly at their playable seams.

```text
                         NORTH (-Z)

              Area 2 — 84 × 72
          root (6, 0, -72)
          playable X -36..48
          playable Z -108..-36
                  │
                  │ river seam at Z = -36
                  │
 Area 1 — 72 × 72 ├──────────── small A2/A3 shared corner/gate
 root (0, 0, 0)   │
 X -36..36        │
 Z -36..36        │ Area 3 — 84 × 72
                  │ root (78, 0, 0)
                  │ playable X 36..120
                  │ playable Z -36..36
                         EAST (+X)
```

This produces these world-space envelopes:

| Area | Playable X | Playable Z | Visual X | Visual Z |
| --- | ---: | ---: | ---: | ---: |
| Area 1 | `-36..36` | `-36..36` | `-42..42` | `-42..42` |
| Area 2 | `-36..48` | `-108..-36` | `-42..54` | `-114..-30` |
| Area 3 | `36..120` | `-36..36` | `30..126` | `-42..42` |

The visual envelopes overlap; the playable envelopes meet at their intended seams. **Do not add another 12 m gap between areas.** The 12 m transition band is the overlap created by the two 6 m visual aprons.

## Shared transition bands

Transitions are shared presentation chunks, not duplicated scenery baked independently into both neighboring area GLBs.

Canonical naming rule:

```text
Transition_A<lower-id>_A<higher-id>_<Theme>
```

Always sort the area IDs. Do not use a directional `A01_to_A02` name because the same transition is viewed and crossed in both directions.

Suggested file names use the same identity in kebab case:

```text
transition-a01-a02-river.glb
transition-a01-a03-ruined-wall.glb
```

### Area 1 ↔ Area 2 — river

Canonical shipping root:

```text
Transition_A01_A02_River
```

The playable seam is:

```text
world Z = -36
```

The visual overlap is:

```text
world X = -42..42
world Z = -42..-30
```

So the nominal shared river band is **84 m long × 12 m deep**.

Its world placement is:

```text
(0, 0, -36)
```

Inside the shipping root, author locally around:

```text
X = -42..42
Z = -6..6
```

The river does not need to be a perfectly straight 12 m rectangle. The 12 m is the guaranteed overlap budget. Banks, coves, rocks and waterfalls can extend visually where composition requires it.

The transition chunk should own scenery that would otherwise be duplicated across both area exports, especially:

- shared water surface;
- bridge/causeway crossing the seam;
- seam rocks and river props;
- cross-boundary effects or vegetation that must match from both sides.

Area 1 and Area 2 terrain may each form their respective banks, but do not bake two competing copies of the same river water/bridge into both GLBs.

### Area 1 ↔ Area 3 — ruined wall

Canonical shipping root:

```text
Transition_A01_A03_RuinedWall
```

The playable seam is:

```text
world X = 36
```

The visual overlap is:

```text
world X = 30..42
world Z = -42..42
```

So the nominal shared ruined-wall band is **12 m deep × 84 m long**.

Its world placement is:

```text
(36, 0, 0)
```

Inside the shipping root, author locally around:

```text
X = -6..6
Z = -42..42
```

This chunk should own the gate/wall/rubble geometry that must line up from both Area 1 and Area 3. The neighboring area scenes should blend into it rather than each containing a duplicate wall.

### Area 2 ↔ Area 3

The existing game also has an Area 2 ↔ Area 3 connection. With the target rectangles above, their visual envelopes naturally overlap around the southeast corner of Area 2 / northwest corner of Area 3:

```text
world X = 30..54
world Z = -42..-30
```

That is sufficient room for the existing gate/transition concept. Do not lock a production theme/name for this shared chunk until Area 2 and Area 3 are authored; use the current `connections.json` gameplay connection as authority in the meantime.

When the art direction is chosen, use:

```text
Transition_A02_A03_<Theme>
```

## Preferred Three.js Editor workflow: one master authoring scene

Do **not** make day-to-day art iteration depend on opening Area 1, then the river, then Area 2 separately.

Keep an assembled master scene where connected areas and transitions are visible at their final world placement while editing. This lets river banks, bridges, ruined walls, vegetation, terrain heights, collision guides and sight lines be adjusted in context.

The master scene is an **authoring source**, not a shipping asset.

Recommended hierarchy:

```text
AUTHORING_WORLD                         position 0,0,0
│
├─ Placement_A01                       position (0,0,0)
│  ├─ Area_A01_Root                    position 0,0,0 / rotation 0 / scale 1
│  │  ├─ Terrain
│  │  ├─ Vegetation
│  │  ├─ Rocks
│  │  ├─ Structures
│  │  └─ Props
│  ├─ GAMEPLAY_GUIDES
│  │  ├─ COLLIDER_House_01
│  │  ├─ COLLIDER_WestCliff_01
│  │  └─ ...
│  ├─ REF_Playable_72x72
│  └─ REF_Visual_84x84
│
├─ Placement_Transition_A01_A02        position (0,0,-36)
│  ├─ Transition_A01_A02_River         position 0,0,0 / rotation 0 / scale 1
│  │  ├─ Water
│  │  ├─ Bridge
│  │  ├─ Rocks
│  │  └─ RiverVegetation
│  ├─ GAMEPLAY_GUIDES
│  │  ├─ COLLIDER_RiverWest
│  │  └─ COLLIDER_RiverEast
│  └─ REF_Transition_84x12
│
├─ Placement_A02                       position (6,0,-72)
│  ├─ Area_A02_Root                    position 0,0,0 / rotation 0 / scale 1
│  │  ├─ Terrain
│  │  ├─ Vegetation
│  │  ├─ Rocks
│  │  ├─ Structures
│  │  └─ Props
│  ├─ GAMEPLAY_GUIDES
│  ├─ REF_Playable_84x72
│  └─ REF_Visual_96x84
│
├─ Placement_Transition_A01_A03        position (36,0,0)
│  ├─ Transition_A01_A03_RuinedWall    position 0,0,0 / rotation 0 / scale 1
│  │  ├─ Wall
│  │  ├─ Gate
│  │  ├─ Rubble
│  │  └─ SeamProps
│  ├─ GAMEPLAY_GUIDES
│  │  ├─ COLLIDER_RuinedWallNorth
│  │  └─ COLLIDER_RuinedWallSouth
│  └─ REF_Transition_12x84
│
└─ Placement_A03                       position (78,0,0)
   ├─ Area_A03_Root                    position 0,0,0 / rotation 0 / scale 1
   │  ├─ Terrain
   │  ├─ Fortress
   │  ├─ Vegetation
   │  ├─ Rocks
   │  └─ Props
   ├─ GAMEPLAY_GUIDES
   ├─ REF_Playable_84x72
   └─ REF_Visual_96x84
```

`GAMEPLAY_GUIDES` and `REF_*` are authoring-only and must never ship as visible GLB content.

### Placement parent vs shipping root

This distinction is mandatory.

The `Placement_*` parent contains the **world transform used only to assemble the authoring scene**.

The child `Area_*_Root` or `Transition_*` node is the **independently exportable shipping root** and always remains:

```text
position = (0,0,0)
rotation = (0,0,0)
scale    = (1,1,1)
```

Example:

```text
Placement_A02                     world position (6,0,-72)
└─ Area_A02_Root                  local position (0,0,0)
```

Do not move `Area_A02_Root` itself to `(6,0,-72)`.

Likewise:

```text
Placement_Transition_A01_A02      world position (0,0,-36)
└─ Transition_A01_A02_River       local position (0,0,0)
```

This lets the master scene look exactly like the assembled world while keeping each export clean and reusable.

### Editing transitions in context

The transition should normally be edited **inside the master scene with both neighboring areas visible**.

For the river:

```text
open AUTHORING_WORLD
    ↓
see Area 1 + river + Area 2 together
    ↓
edit river / bridge / banks / collision guides / seam rocks / nearby vegetation
    ↓
inspect immediately from both sides
    ↓
save master authoring scene
```

There is no requirement to open the river alone just to change it.

The same applies to `Transition_A01_A03_RuinedWall`: edit the wall/gate/rubble and its movement blockers while Area 1 and Area 3 remain visible.

### Ownership boundary while editing

Even though everything is visible together, keep content ownership strict.

If an object belongs to the shared river, place it under:

```text
Transition_A01_A02_River
```

If a collision guide describes that shared river, place it under the transition's sibling `GAMEPLAY_GUIDES` group beneath `Placement_Transition_A01_A02`.

If scenery or collision belongs only to Area 1, place it under the Area 1 placement group.

A useful visual rule is:

> If the object must remain visually identical while either side of the seam is loaded, the transition chunk probably owns it.

A useful gameplay rule is:

> If the movement restriction exists because of a shared transition feature, the transition gameplay data owns it even though the runtime collision itself is not streamed.

## Collision authoring workflow

### Principle

Three.js Editor is the **authoring UI** for collision placement, not the runtime collision engine.

Do not use Gaea terrain triangles, GLB mesh geometry, water meshes, rocks, walls or houses directly as gameplay collision. That would couple movement correctness to presentation detail and make streaming/disposal affect gameplay.

Instead, visually place simple editor-only guides over the scenery that should block movement, then convert those guides into renderer-independent authored collision data.

The current Infuse collision type is deliberately simple:

```text
rectangle: id + x + z + width + depth
```

It is currently axis-aligned. Until the gameplay schema explicitly gains rotation, keep `COLLIDER_*` boxes unrotated. If a diagonal cliff or wall needs approximation, use several rectangles rather than silently relying on a rotated editor box the runtime cannot represent.

### Guide naming

Use:

```text
GAMEPLAY_GUIDES
├─ COLLIDER_<ReadableId>
├─ COLLIDER_<ReadableId>
└─ ...
```

Examples:

```text
COLLIDER_RiverWest
COLLIDER_RiverEast
COLLIDER_House_01
COLLIDER_WestCliff_01
COLLIDER_RuinedWallNorth
```

Use stable names once gameplay data has been generated from them so later re-exports update the same collision IDs rather than creating new ones unnecessarily.

### Guide representation

For now, use simple BoxGeometry meshes as translucent/wireframe editor helpers:

- X/Z position and X/Z dimensions represent the gameplay rectangle;
- Y position/height are only for comfortable editor visibility and are ignored by 2D movement collision;
- rotation must remain zero while runtime supports axis-aligned rectangles only;
- material/color are authoring convenience only;
- guides are excluded from shipping GLBs.

Do not trace every visible object exactly. Use collision where the environment clearly communicates “the hero cannot walk here.” Small decorative rocks, grass and props should generally remain non-colliding unless gameplay readability requires otherwise.

### River + bridge pattern

For `Transition_A01_A02_River`, the player should not collide with the bridge. The river itself is blocked **except for the bridge/causeway opening**.

Author two blockers:

```text
                 Area 2

   COLLIDER_RiverWest      COLLIDER_RiverEast
   ┌────────────────┐      ┌────────────────┐
~~~│~~~~~~~~~~~~~~~~│ bridge│~~~~~~~~~~~~~~~~│~~~
   │                │   │   │                │
   └────────────────┘   │   └────────────────┘
                         │
                    walkable opening
                         │
                 Area 1
```

Resize and position the two blockers while looking at the actual water, banks and bridge. Leave enough clearance around the bridge edges that mobile movement feels forgiving rather than pixel-perfect.

The bridge can have visual rails/rocks that receive their own small blockers only if they materially improve movement behavior. Avoid over-colliding decorative details.

### Area and transition collision ownership

Area-local blockers belong conceptually to that area's gameplay definition:

```text
Placement_A01
├─ Area_A01_Root
└─ GAMEPLAY_GUIDES
   ├─ COLLIDER_House_01
   └─ COLLIDER_WestCliff_01
```

Shared seam blockers belong conceptually to the transition/connection:

```text
Placement_Transition_A01_A02
├─ Transition_A01_A02_River
└─ GAMEPLAY_GUIDES
   ├─ COLLIDER_RiverWest
   └─ COLLIDER_RiverEast
```

Do **not** solve shared river collision by duplicating the same blockers in both Area 1 and Area 2 data.

The exact renderer-independent storage shape for production transition collision should be finalized when the authoring extractor is implemented. It may extend connection/world authored data, but it must not be stored only inside the GLB.

### Collision export/extraction contract

The future authoring/build tool should treat `GAMEPLAY_GUIDES` separately from visual export.

Conceptually:

```text
MASTER AUTHORING scene
      │
      ├─ Area_A01_Root ----------------------> area-a01.glb
      │
      ├─ Transition_A01_A02_River ----------> transition-a01-a02-river.glb
      │
      └─ GAMEPLAY_GUIDES --------------------> renderer-independent collision data
```

For each `COLLIDER_*`, extract at least:

```text
stable collision id
owning area or transition/connection id
local x / z
width / depth
```

Then apply the documented placement transform deterministically when generating world-space gameplay data if the runtime format requires world coordinates.

The extractor must validate rather than silently accept unsupported authoring:

- non-zero rotation while only axis-aligned rectangles are supported;
- non-unit or ambiguous nested scale;
- duplicate collision IDs within the same owner;
- malformed `COLLIDER_*` helper type;
- guide accidentally nested inside the shipping root if the export contract expects it as a sibling.

For the first production proof, manual transcription from a small number of guides into authored JSON is acceptable if needed. Do not manually maintain dozens of coordinates once the workflow scales; build the deterministic extractor.

### Runtime collision rule

Gameplay collision is lightweight and must be available independently of visual residency.

If the river GLB is unloaded, the hero must still be unable to walk into the river. If Area 2's visual GLB is still prefetching, its gameplay gate/collision rules still exist. Visual load failure must never create a collision hole or change where the hero can move.

This is why collision guides are authoring metadata, not runtime scene objects.

## Gaea handoff

Start terrain exports at the **visual** size, not only the playable size:

```text
Area 1 terrain: 84 × 84 m
Area 2 terrain: 96 × 84 m
Area 3 terrain: 96 × 84 m
```

Keep 1 unit = 1 meter and center the exported terrain around the area's local X/Z origin.

Use terrain geometry for broad silhouette/elevation. Do not spend extreme vertex density on tiny erosion/cracks that can be carried by normal/color textures.

For shared water elevations or other cross-area height references, use one common world Y datum. If a Gaea export arrives vertically offset, move the terrain mesh **inside the local area shipping root** to restore the shared datum rather than giving every area an arbitrary root Y offset.

When importing Gaea terrain into the master editor scene, import it under the relevant local `Area_*_Root`; do not bake the `Placement_*` world offset into the terrain itself.

## Independent export workflow

The master authoring scene must eventually produce separate runtime chunks:

```text
area-a01.glb
transition-a01-a02-river.glb
area-a02.glb
transition-a01-a03-ruined-wall.glb
area-a03.glb
```

**Never ship/export the whole `AUTHORING_WORLD` as one world GLB.** Streaming depends on the chunks remaining independently loadable.

### Preferred long-term export path

Add a small deterministic authoring/build export tool once the first real area workflow is proven.

The tool should find canonical shipping roots by name:

```text
Area_A01_Root
Area_A02_Root
Area_A03_Root
Transition_A01_A02_River
Transition_A01_A03_RuinedWall
```

and serialize each independently while excluding:

- its `Placement_*` parent transform;
- neighboring areas/transitions;
- `GAMEPLAY_GUIDES`;
- `REF_*` editor guides;
- other authoring-only helpers.

The exported root must remain normalized at local `(0,0,0)`, zero rotation and unit scale.

The same tool or a companion step should extract validated `COLLIDER_*` guides into renderer-independent authored data.

This process should be repeatable rather than relying on manual transform entry for 15+ areas.

### Manual workflow until export automation exists

For the first Area 1 / river proof, manual export is acceptable.

Use a copy/temporary export scene rather than damaging the master authoring scene:

1. Save the master authoring scene first.
2. Duplicate/open a temporary export copy.
3. Keep only the shipping root being exported and its descendants.
4. Remove the `Placement_*` world wrapper and all unrelated content/guides.
5. Confirm the remaining shipping root is exactly `(0,0,0)`, rotation zero, scale one.
6. Export that chunk to GLB.
7. Manually transfer any required collision-guide values into the gameplay data only for this small proof if no extractor exists yet.
8. Discard the temporary export copy; continue art edits in the master scene.

Do not repeatedly move roots back and forth between local and world coordinates in the master scene.

## Shipping verification / clean assembled preview

The master authoring scene is excellent for art iteration, but it does **not** prove that independent exports retained the correct transforms and ownership.

After exporting, perform a clean assembly check using the exported GLBs themselves — either in a disposable Three.js Editor preview scene or directly through the Infuse production loader.

Place the exported chunks at:

```text
Area_A01_Root                  (0, 0, 0)
Area_A02_Root                  (6, 0, -72)
Area_A03_Root                  (78, 0, 0)
Transition_A01_A02_River       (0, 0, -36)
Transition_A01_A03_RuinedWall  (36, 0, 0)
```

Inspect:

- terrain height continuity;
- river bank alignment;
- bridge/gate alignment;
- wall/rubble seams;
- visible gaps from the actual game camera direction;
- duplicate geometry / z-fighting;
- whether the 6 m apron is sufficient;
- whether any authoring world transform was accidentally baked into an exported GLB;
- whether gameplay collision matches the visible blockers and leaves the intended bridge/gate openings walkable.

This clean re-import is **QA**, not the normal editing workflow.

The intended loop is:

```text
MASTER AUTHORING scene = edit comfortably in context
EXPORTED CHUNKS        = runtime visuals
COLLISION DATA         = lightweight gameplay authority
CLEAN RE-IMPORT/INFUSE = verify both contracts together
```

## Export checklist

Before every production export/update:

1. Save the master authoring scene.
2. Identify the canonical `Area_*_Root` / `Transition_*` shipping root.
3. Confirm that shipping root is locally `(0,0,0)`, zero rotation and unit scale.
4. Confirm the world transform exists only on its `Placement_*` authoring parent / runtime metadata.
5. Confirm 1 unit = 1 meter.
6. Exclude all `GAMEPLAY_GUIDES`, `REF_*` and authoring-only helpers from visual GLBs.
7. Do not include neighboring areas/transitions in the chunk export.
8. Do not duplicate shared transition water/walls/gates in neighboring area chunks.
9. Export the area/transition independently to GLB.
10. Extract/update collision data from `COLLIDER_*` guides, or manually transfer only for the initial small proof.
11. Re-import the exported GLB at its documented world transform and inspect the seam.
12. Test hero movement against the resulting gameplay collision, especially every bridge/gate opening.
13. Optimize shipping assets after editor export; the raw editor export is not automatically the final runtime asset.

## Runtime implications for later Codex work

When production visuals begin replacing blockouts, the rendering layer should use explicit per-area/transition visual metadata rather than assuming every area is 72 × 72 or deriving positions from GLB contents.

At minimum the rendering side will need values equivalent to:

```text
area id
world root position
playable width/depth
visual width/depth
visual provider / GLB URL
shared transition IDs
```

Transitions similarly need:

```text
transition id
connected area IDs
world root position
visual provider / GLB URL
```

The GLB itself remains local around `(0,0,0)`.

The master Three.js Editor `Placement_*` positions are authoring representations of those runtime world transforms. Codex should use documented transforms/manifest values as authority when wiring loaders; it should not parse placement parents from shipping GLBs because those parents are deliberately not exported.

Transitions should be independently loadable and remain resident whenever their connection needs to be visible. `5-area-streaming.md` defines the runtime residency behavior.

Gameplay JSON/world data remains authoritative for collisions, spawns, gates and progression. `GAMEPLAY_GUIDES` are a visual authoring input used to generate/update that data; they are never a runtime dependency. When production area dimensions/origins are accepted, update authored gameplay/world data intentionally so gameplay coordinates and the rendering manifest describe the same world.

## Quick reference

```text
Axes:       +X east, -Z north, +Y up
Units:      1 unit = 1 meter
Apron:      6 m per visual side

Area 1:     playable 72×72, visual 84×84, root world (0,0,0)
Area 2:     playable 84×72, visual 96×84, root target (6,0,-72)
Area 3:     playable 84×72, visual 96×84, root target (78,0,0)

A1/A2:      Transition_A01_A02_River
            seam Z=-36, nominal overlap 84×12
            world placement (0,0,-36)

A1/A3:      Transition_A01_A03_RuinedWall
            seam X=36, nominal overlap 12×84
            world placement (36,0,0)

Authoring source:       assembled MASTER scene
World offset in editor: Placement_* parent
Shipping root:          ALWAYS local (0,0,0)
Production export:      one independent GLB per Area_* / Transition_*
Collision authoring:    editor-only GAMEPLAY_GUIDES / COLLIDER_* boxes
Collision runtime:      renderer-independent data, never streamed with visuals
Final seam QA:          re-import exported chunks + test gameplay collision
```