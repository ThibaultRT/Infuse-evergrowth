# Slice 12 — Environment production pipeline

## Why this slice exists

Slices 11A/11A.5/11B proved that the world topology, continuous traversal and broad biome positions work, but they also exposed the wrong production method for final scenery. `EnvironmentView.ts` is still being used as a level editor: roads, walls, cliffs, lakes, courtyards and decoration are created from code and hand-authored coordinates. That is useful for blockout, but it is not a reliable way to reach the approved visual target.

The next work therefore changes **how environments are authored**, not the game engine.

## Decision

- **Keep Three.js** as the runtime renderer.
- **Do not build an Infuse-specific level editor.**
- Use **Blender** as the primary external 3D level-authoring tool whenever a visual editor is needed.
- Keep gameplay, combat, progression, gates, enemy logic, save state and collision authority in the existing renderer-independent Infuse runtime.
- Treat the approved high-detail world concept as art direction, not as geometry that Codex must interpret directly.
- Add a second, intentionally simple **construction blueprint** that defines topology/ground shapes without decorative assets.
- Stop asking Codex to invent major visible scenery from `BoxGeometry`, `IcosahedronGeometry`, `CircleGeometry`, etc. Those primitives remain acceptable only for invisible collision/debug geometry and truly simple surfaces where their shape is not visually exposed.

This slice is a pipeline reset. Do not attempt another whole-world beauty pass before the pipeline is proven on one representative gameplay view.

---

# 12A — Full environment asset audit and visual catalogue

## Goal

Know exactly which real reusable assets are available before designing with them.

The current runtime subset is intentionally tiny compared with the source Standard packs. The source audit already established that the supplied packs contain approximately:

- Medieval Village MegaKit Standard: 176 glTF models;
- Stylized Nature MegaKit Standard: 68 glTF models;
- Fantasy Props MegaKit Standard: 94 glTF models.

The current browser subset only contains a small selection of trees, rocks, vegetation, fences, one brick floor, one brick door frame and one door. That is not enough to author the target world without procedural stand-ins.

## Required source packs

Audit the actual supplied Standard archives, not marketing screenshots:

1. Medieval Village MegaKit [Standard]
2. Stylized Nature MegaKit [Standard]
3. Fantasy Props MegaKit [Standard]

If the original source archives are not available in the working environment, **stop and report that fact**. Do not invent filenames or substitute procedural geometry while claiming the catalogue is complete.

## Deliverables

Create `WIP/environment-asset-catalog.md` with one row per useful environment model. Record:

- exact source pack;
- exact source filename;
- category;
- approximate dimensions in metres;
- triangle count when practical;
- likely use in Infuse;
- whether it is already in the runtime subset;
- proposed runtime path if selected;
- notes about pivot/orientation/texture sharing.

Minimum categories:

- ground/path pieces;
- grass/soil/stone surfaces;
- small/medium/large rocks;
- cliff/high-ground candidates;
- deciduous trees;
- conifers/dead trees;
- bushes/grass/flowers;
- fences/palisades;
- bridges/causeways;
- houses/village structures;
- wells/carts/barrels/crates/signs;
- wall segments;
- wall corners/end-caps;
- arches/gates;
- towers;
- ruined/broken structures;
- stairs/platforms;
- rubble/debris.

## Visual contact sheets

The catalogue must include **renders of the actual models**, not AI approximations.

Preferred workflow:

1. use Blender as the renderer if available;
2. import the real glTF models;
3. use one neutral light rig and one fixed isometric camera close to Infuse's gameplay camera;
4. render transparent-background thumbnails;
5. label each thumbnail with its exact filename;
6. group them into contact sheets by category.

Suggested output directory:

```text
WIP/environment-catalog/
├── nature-rocks.png
├── nature-vegetation.png
├── village-structures.png
├── village-walls-gates.png
├── ruins.png
└── props.png
```

If Blender is unavailable in the agent environment, use an existing glTF preview/rendering tool where practical. A small temporary catalogue-render script is acceptable, but do **not** build a custom level editor.

## 12A exit criteria

- the full three environment source packs have been inspected;
- no important environment category relies on guessed asset names;
- the user can visually choose assets from labelled contact sheets;
- selected runtime candidates are explicit before implementation starts.

---

# 12B — Construction blueprint

## Goal

Separate **where the world is** from **what decorative models are used**.

Create and maintain a deliberately simple top-down/orthographic blueprint for Areas 1–3. This is the authoritative layout reference for ground, borders, roads and major playable spaces.

The blueprint must not contain detailed houses, trees, barrels, fancy towers or atmospheric painting. It should be readable like a level-design map.

## Canonical topology

Preserve Slice 11's established world topology:

```text
Area 2: x -18..+58, z -84..-28
Area 1: x -18..+18, z -28..+28
Area 3: x +18..+58, z -28..+28
```

Connections remain approximately:

- A1 ↔ A2: `(x +8, z -28)`;
- A2 ↔ A3: `(x +38, z -28)`;
- A1 ↔ A3: `(x +18, z 0)`;
- future west exit from Area 1 through high terrain;
- future south exit from Area 1 across the rift/chasm.

## Blueprint visual language

Use flat colors/shapes only:

- light green = Area 1 walkable grass;
- darker/desaturated green = Area 2 walkable ground;
- gray = Area 3 walkable ruined-fortress ground;
- tan = main roads/path network;
- blue = lake/water, explicitly non-walkable except the crossing;
- dark brown/black = rift floor/depth;
- rocky gray band = west high terrain/mountain boundary;
- thick gray line = fortress wall footprint;
- yellow opening = active gate/crossing;
- orange/hatched opening = future/locked passage;
- outlined circles/polygons = combat clearings;
- thin gray interior lines in Area 3 = future rooms/corridors.

The blueprint should show at least:

- Area 1 central combat/village clearing;
- all four Area 1 road branches;
- the north lake with only the gate/causeway opening;
- the west elevated boundary;
- the south rift and reserved future crossing;
- the east fortress wall and A1↔A3 gate;
- Area 2 road continuation to both southern gates;
- Area 3 broad courtyard/room/corridor zones without decorative assets.

## Source of truth

The committed SVG `WIP/environment-layout-blueprint.svg` is the deterministic construction reference. The high-detail concept image remains the art-direction target.

When the two conflict:

- use the SVG for world placement/topology;
- use the concept for mood, richness, proportions of visual masses and overall quality.

---

# 12C — Blender-authored static environment pipeline

## Goal

Use an existing visual 3D editor for placement rather than hard-coding the final world in TypeScript.

## Authoring tool

Use **Blender** for static environment composition.

Recommended Blender scene setup:

```text
INFUSE_WORLD
├── A1_GROUND
├── A1_STATIC
├── A2_GROUND
├── A2_STATIC
├── A3_GROUND
├── A3_STATIC
├── WATER_SHAPES
├── OCCLUDERS
├── LANDMARKS
├── GATE_FRAMES_STATIC
└── REFERENCE_ONLY
```

Set Blender units to metres. Import the curated Quaternius glTF assets at true scale. Use linked duplicates/instances for repeated props rather than unique mesh copies where practical.

## What belongs in Blender

Blender should author visible, static environment presentation:

- terrain/ground meshes;
- road/path surfaces;
- shore geometry;
- cliff/high-ground visible meshes;
- fortress walls and ruins;
- static gate frames/gatehouses;
- houses and landmark structures;
- rocks/trees/bushes/fences;
- rubble/props;
- Area 3 room/corridor visual structure.

## What must stay outside Blender

Do not move gameplay authority into the art scene:

- hero movement rules;
- area IDs/unlocks;
- boss progression;
- gate open/locked state;
- enemy/spawn state;
- combat;
- save data;
- enemy AI;
- collision authority needed by gameplay.

Dynamic doors may remain in `GateView`, aligned to a static Blender-authored frame, or may use a named exported node if the runtime can animate it safely. Progression remains authoritative either way.

## Export strategy

Preferred first implementation:

- export one static GLB per area: `area1-environment.glb`, `area2-environment.glb`, `area3-environment.glb`;
- preserve world scale and deterministic origins;
- use stable node names for materials/objects that need runtime handling (`WATER_*`, `OCCLUDER_*`, `GATEFRAME_*`);
- load these GLBs through `AssetLoader`/`EnvironmentView`;
- keep existing procedural blockout behind a development fallback until the exported scene is proven.

Do not keep visually exposed procedural walls/rocks merely because they are already coded.

## Versioning the authored source

Do not commit the original Quaternius ZIP archives.

The preferred repository source of truth is:

1. curated runtime Quaternius assets;
2. exported area GLBs used by the game;
3. construction blueprint;
4. environment catalogue and placement notes.

If a `.blend` source file remains comfortably within GitHub limits, it may be versioned. If it becomes large because of packed textures/source libraries, keep it external and version the exported GLBs plus an explicit asset/placement manifest. Do not pack hundreds of source assets into one giant repository blob merely for convenience.

## Renderer simplification

Once one Blender-authored area loads correctly, simplify `EnvironmentView.ts` so it becomes primarily a scene loader/composer rather than the author of walls, roads, rocks and courtyards.

Procedural Three.js geometry remains appropriate for:

- invisible/debug collision helpers;
- simple water rendering if the authored water mesh only supplies shape;
- temporary fallback when an asset fails;
- small effects that are genuinely procedural.

---

# 12D — One-screen quality proof

## Goal

Prove the new pipeline can create **one genuinely good gameplay screen** before expanding the whole world.

Do not rebuild Areas 1–3 simultaneously.

## Target view

Use Area 1 near the central clearing, with the camera looking toward the north/north-east route so the screen can contain:

- hero and enemies at normal gameplay scale;
- grass/ground variation;
- a readable real path;
- real tree/rock/fence clusters;
- one small village landmark;
- the lake/shoreline in the upper distance;
- the A1↔A2 gate/causeway visible or implied;
- no void;
- no giant foreground occluder;
- enough open floor for combat.

The target is **not** to match the concept pixel-for-pixel. The target is to show that the runtime can achieve comparable environmental richness/readability at the actual portrait camera.

## Quality bar

Reject the proof if any of the following are still true:

- large visible walls/cliffs are obvious primitive boxes;
- boulders form repeated identical chains;
- roads are flat geometric strips with no asset/terrain integration;
- lake shoreline is a straight rectangle;
- environment density is mostly empty ground;
- foreground scenery covers the hero/combat area;
- blue/sky void is visible at normal movement bounds;
- the screen still reads as a blockout.

## Review loop

1. author in Blender;
2. export GLB;
3. load in Infuse;
4. test at 390×844 CSS portrait viewport and on the user's iPhone;
5. capture screenshot;
6. compare against the approved target for density/readability;
7. adjust in Blender, not by adding another set of one-off procedural coordinates in TypeScript.

12D ends only when the user explicitly approves this representative view.

---

# 12E — Scale the approved recipe across Areas 1–3

Only after 12D approval:

1. finish Area 1 using the same asset language/density;
2. author Area 2 as a darker related landscape, keeping the northern row and both southern connections readable;
3. author Area 3 as a ruined-fortress biome with courtyards, broken rooms and corridors;
4. align Area 3 encounter/spawn positions with those authored spaces;
5. preserve cutaway/occlusion-safe composition for the portrait camera;
6. optimize repeated static meshes/materials only after profiling;
7. validate PWA payload, Safari performance and release checks.

## Final success criteria

- the world no longer looks authored from primitive Three.js blocks;
- roads visually guide the player to gates;
- borders look like terrain/architecture rather than map edges;
- static environment creation happens primarily in Blender/real assets;
- Three.js remains the runtime renderer;
- gameplay systems remain renderer-independent;
- one approved visual recipe is repeated consistently rather than independently reinvented per area.

---

# Immediate execution order

1. Complete **12A** and present the real asset contact sheets.
2. Review/approve `WIP/environment-layout-blueprint.svg` for **12B**.
3. Implement the minimal GLB loading/export pipeline for **12C**.
4. Build only the **12D Area 1 showcase view**.
5. Stop for user review before starting 12E.

Do not start 12E automatically.