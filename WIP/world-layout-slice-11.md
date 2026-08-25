# Slice 11 — Continuous Multi-Area World Layout

## Current status

Slice **11A is implemented and accepted only as a topology/navigation proof**.

The phone playtest confirms the intended world arrangement now exists:

- Area 1 remains the bright starting area;
- Area 2 is north of Area 1 and extends east over Area 3;
- Area 3 is east of Area 1;
- Area 1 ↔ Area 2 is represented by a northern water frontier;
- Area 1 ↔ Area 3 is represented by the ruined-fortress boundary;
- Area 2 ↔ Area 3 has its own southern connection;
- Area 1 west is reserved for a mountain/pass boundary and future Area 4;
- Area 1 south is reserved for a rift/chasm boundary and future progression;
- traversal is continuous through physical world connections rather than a visible teleport.

The current 11A visuals are **not approved as production-quality macro environment art**. They are blocking geometry only.

Do not interpret this as permission to add small props around the current blocks. The next pass must first rebuild the macro visuals themselves.

---

## Approved topology — do not redesign in 11A.5

Keep the current authored topology unless the phone playtest exposes a very small dimensional correction:

```text
        NORTH / decreasing Z

+----------------------------------------------+
|                    AREA 2                    |
|              width 76 × depth 56             |
|                                              |
|    [A1↔A2 gate]              [A2↔A3 gate]    |
+------------------+---------------------------+  Z = -28
|      AREA 1      |          AREA 3           |
|      36×56       |          40×56            |
|                  |                           |
| [future west]    [A1↔A3 gate]                |
|                  |                           |
|   [future south / rift crossing]             |
+------------------+---------------------------+  Z = +28
X=-18             X=+18                       X=+58
```

Preserve the progression semantics established by 11A:

1. Area 1 starts unlocked.
2. Area 1 boss unlocks Area 2.
3. Area 2 boss unlocks Area 3.
4. A1 ↔ A3 exists physically from the start but remains closed until Area 3 is unlocked.
5. Once Area 3 is unlocked, A1 ↔ A3 and A2 ↔ A3 are bidirectional.

Do not change save semantics, combat rules, spawn rolls, equipment, or progression while rebuilding the environment.

---

# Why the current visuals fail

The problem is not just missing decoration. Several visible macro objects are currently primitive placeholders:

- the lake is essentially a flat blue plane;
- the west mountains are repeated/scaled dodecahedrons;
- the rift is primarily a dark flat polygon;
- the Area 3 fortress is rows of `BoxGeometry` blocks;
- the current `GateView` is also built from boxes and no longer uses the actual Quaternius round brick frame + wooden door as its primary model.

These are acceptable as geometry blockers, but they are not an acceptable base for the visual-detail pass.

## Critical diagnosis: the Area 3 occlusion is understood

Do **not** ask Codex to “find why the east wall occludes the hero” again. The likely dominant cause is explicit in the current geometry and camera relationship.

The normal camera follows from approximately:

```text
camera = (hero.x, 19, hero.z + 16.5)
lookAt = (hero.x, 0.9, hero.z - 2.5)
```

The camera therefore sits **south of the hero and looks north**.

`EnvironmentView.buildRuinedFortress()` currently creates a full-width, full-height wall on Area 3's **south / foreground edge**:

```ts
this.wall(0, 28, 40, 2.2, 5.8)
```

That wall is directly between the fixed portrait camera and large portions of Area 3. Because `wall()` builds many stacked opaque boxes, it becomes the horizontal bands that fill the phone screenshots.

There are also tall west-boundary/interior wall pieces that can obstruct the hero near the A1 ↔ A3 entrance.

This is a **camera-foreground architecture problem**, not a texture problem and not primarily a camera-bug problem.

Do not attempt another blind fix by changing random wall scale, near/far clipping planes, or camera height. Solve it deterministically as specified below.

---

# Slice 11A.5 — Macro visual reconstruction

## Goal

Keep the working 11A world topology/navigation, but rebuild the visible border language so that **Area 1 already looks like a credible game environment before 11B adds density**.

11A.5 is successful when a phone screenshot of any Area 1 border reads as a stylized authored environment rather than a level-editor blockout.

This slice is not about filling the world with barrels/flowers/ruined rooms. It is about replacing the macro placeholders themselves.

## Mandatory implementation order

Implement in this order so failures are easy to diagnose:

1. camera-occlusion fix;
2. real gate reconstruction;
3. east fortress boundary reconstruction;
4. north lake/shore reconstruction;
5. west mountain/ridge reconstruction;
6. south rift reconstruction;
7. phone validation from predefined positions.

Do not jump to small environmental dressing before steps 1–6 are visually accepted.

---

## 11A.5.1 — Fix fortress occlusion deterministically

### A. Remove the known foreground wall failure

The current full-height Area 3 south wall at local `z = +28` must **not remain as an opaque 5.8 m wall across the full width**.

Replace it with a camera-aware ruined/cutaway treatment:

- low surviving wall foundations/rubble on the camera-facing south edge, approximately 0.5–1.3 m tall;
- occasional taller tower fragments only near corners or significantly outside the normal camera-to-hero corridor;
- visible ruins must still communicate that Area 3 was enclosed by a gigantic fortress, but the foreground edge behaves like a cutaway game set;
- the north/east/back portions may remain much taller because they do not sit between the standard camera and the hero in the same way.

The concept-art requirement “Area 3 is enclosed by gigantic ruined castle walls” describes the world fiction and silhouette. It does **not** require an opaque six-metre wall between the player and camera.

### B. Add a generic static-environment occlusion safety net

Do not rely only on hand-tuned wall height. Add a small rendering-only occlusion system for tall static scenery.

Recommended design:

- tag only tall static environment objects/groups that are allowed to fade, e.g. `userData.cameraOccluder = true`;
- each render frame, cast a small number of rays from the camera toward representative hero points (torso/head, not hundreds of rays);
- if a tagged static environment mesh intersects those rays before the hero, smoothly fade that occluder to a low opacity or hide its camera-facing section;
- restore it smoothly when it is no longer between camera and hero;
- this is presentation-only: collision and gameplay geometry remain unchanged;
- do not fade enemies, loot, gates currently being crossed, UI, or the hero;
- avoid cloning materials every frame; prepare fade-capable material instances once for tagged occluders.

A simple dedicated rendering helper such as `EnvironmentOcclusionManager` is preferable to putting more branches in `Game.ts`.

### C. Add a development diagnostic

When the existing renderer statistics/debug mode is enabled, expose enough information to identify future occlusion rather than guessing again. At minimum, show the number/names or IDs of currently faded environment occluders.

### D. Occlusion acceptance test

Capture portrait screenshots with the hero:

1. immediately west of A1 ↔ A3 gate;
2. immediately east of A1 ↔ A3 gate;
3. 8–10 m inside Area 3;
4. near Area 3 south half;
5. near an Area 3 interior wall once 11B adds one.

At every position:

- the hero's full body must remain readable;
- no opaque wall may cover most of the central gameplay viewport;
- the environment may frame the screen edges, but it must not turn the camera into a view from behind masonry.

Do not declare the issue fixed from code inspection alone.

---

## 11A.5.2 — Rebuild physical gates as real landmarks

The current all-box `GateView` is a placeholder and should not be polished further.

Restore **asset-first gate construction**:

- use the already shipped Quaternius `DoorFrame_Round_Brick.gltf` and `Door_4_Round.gltf` as the primary visible gate components where appropriate;
- support both X and Z orientations;
- preserve gameplay-owned locked/open state;
- preserve the existing opening animation through a parent pivot;
- build the A1 ↔ A2 gate into a real short causeway/bridge transition across the shoreline;
- integrate `Prop_WoodenFence_*`, rocks and vegetation around the gate rather than adding giant primitive cylinders/towers;
- A1 ↔ A3 and A2 ↔ A3 gates should visually belong to the ruined fortress system and feel heavier/older than the lake gate.

Procedural geometry may still be used for invisible collision, foundations, or subtle support pieces. It must not be the dominant visible gate art.

If the current curated runtime subset does not contain the required architectural pieces, do **not** silently substitute another giant block structure. Prefer one of these options, in order:

1. curate additional models from the already-approved Quaternius Medieval Village / Nature source packs if those source files are available in the Codex workspace;
2. if they are not available, document the exact missing model families and continue with the best existing Quaternius gate as a temporary but visually coherent landmark;
3. only then consider a new CC0 source as a separate, explicit asset decision.

Do not download arbitrary third-party assets without recording provenance/license.

---

## 11A.5.3 — Rebuild the Area 3 west/east fortress silhouette

The A1 east boundary must feel like the exterior of a ruined fortress, not stacked Minecraft-like rows.

Target visual structure:

- 2–4 major wall segments rather than one perfectly uniform wall;
- broken height profile;
- collapsed sections/rubble slopes;
- at least one taller tower mass set back from the playable edge;
- the A1 ↔ A3 gate should be the strongest opening in this silhouette;
- use real Quaternius architecture wherever possible;
- use repeated props/materials intelligently rather than hundreds of unique objects.

For the fixed portrait camera:

- keep tall masses mostly on the **far/north/east** side of Area 3;
- camera-facing/south fragments should be low or fadeable;
- near the A1 ↔ A3 gate, do not create a tall continuous piece close enough to fill the right half of the screen when the hero stands at the threshold.

The wall may look massive because of length, layered depth, towers and distant height. It does not need every meter to be 6 m tall.

---

## 11A.5.4 — Rebuild the north lake as shoreline + water, not a blue rectangle

Keep the lake in the same macro location, but reconstruct its visual edge.

Requirements:

- water surface extends beyond the playable border so the player never sees its rectangular end;
- shoreline is irregular and overlaps the grass boundary;
- use Quaternius rocks at varied but plausible scale along the shore;
- add sparse bushes/grass/trees to create a natural transition;
- add 1–3 small rock/island shapes if they improve depth;
- road clearly narrows into the fortified crossing/causeway;
- Area 2 terrain is visible beyond the crossing;
- water remains a visual/collision boundary except at the gate opening.

A simple water material is still acceptable. The priority is shoreline composition and believable depth, not a complex shader.

---

## 11A.5.5 — Rebuild the west boundary as a layered mountain/ridge

Remove the giant repeated dodecahedron columns that currently dominate the portrait viewport.

Use a layered natural ridge:

- playable boundary remains near Area 1 west edge;
- small/medium rocks closest to the playable edge;
- larger elevation and rock masses are progressively farther outside the walkable area;
- use the available Quaternius rock models as the visible surface language;
- mix trees/bushes into the rock formations;
- leave a readable future Area 4 mountain pass;
- avoid any single rock mass occupying roughly more than 20–25% of the normal gameplay viewport at once;
- never expose blue/sky void behind the ridge in normal play.

If additional larger Quaternius rock/cliff models are available from the already-approved Nature pack, curate them rather than scaling tiny rocks to absurd size.

---

## 11A.5.6 — Rebuild the south rift with actual depth

The current dark polygon must stop reading as missing ground.

Build the rift as a depressed world feature:

- irregular top rim in the terrain;
- visible inner cliff faces dropping below the grass plane;
- dark rock/earth bottom at least ~1.5–2.5 m below the playable surface;
- scattered rim rocks and vegetation;
- a clearly authored future crossing/bridge location aligned with the south road;
- the crossing remains sealed/non-traversable until a future area exists;
- extend geometry far enough beyond the camera view that no blue/void background appears behind it.

Use procedural geometry for the actual cut/depth if necessary, but dress its visible surfaces with the same stylized rock language as the rest of the environment. The rift should read as terrain, not a black overlay.

---

## 11A.5.7 — Road/path cleanup

Keep the existing road topology, but improve the macro appearance while rebuilding borders:

- roads should visibly lead to each real/future exit;
- avoid hard rectangular path intersections where practical;
- prefer Quaternius path tiles/accents or softly overlapping path segments;
- do not repave the entire Area 1 floor;
- keep enough open grass for combat readability.

This is still macro composition, not detailed prop dressing.

---

## 11A.5 exit criteria

11A.5 is approved only when the user can play it on a phone and all of the following are true:

- no normal Area 1 border view exposes obvious sky/void holes;
- west border reads as elevated natural terrain rather than giant primitive blobs;
- north border reads as a lake with a shoreline rather than a blue rectangle;
- south border reads as a deep rift/chasm rather than a dark plane;
- east boundary reads as a ruined fortress rather than stacked box rows;
- gates look like authored 3D structures, not primitive block assemblies;
- hero remains readable around/inside Area 3 and the known foreground wall occlusion is demonstrably fixed;
- continuous traversal/progression from 11A still works;
- existing gameplay/save behavior is preserved;
- `npm run build` succeeds;
- `npm run validate:release` succeeds;
- portrait screenshots are provided from each border and from both sides of A1 ↔ A3.

Do **not** start 11B until these criteria are met.

---

# Slice 11B — Environmental composition and authored encounters

## Goal

Once 11A.5 makes the macro world credible, 11B adds the **richness, landmarks and intentional encounter spaces** visible in the approved concept art.

11B should move the game from “good macro environment” to “authored RPG level”.

The target is not a pixel-perfect recreation of concept art. Preserve gameplay readability, portrait-camera visibility and mobile performance.

---

## 11B.1 — Area 3 ruined-fortress interior

Area 3 should become the strongest authored level of the first three areas.

Build several recognizable spaces using ruined walls, broken rooms and corridors:

- 2–3 larger ruined courtyards/rooms suitable for groups/boss-like encounters;
- 2–4 smaller rooms/alcoves;
- broken corridors connecting them;
- partial walls that guide movement without creating a maze of invisible collision;
- collapsed openings/rubble that explain inaccessible gaps;
- one or two visual landmarks visible from multiple parts of the area.

Design all interior walls for the fixed portrait camera:

- foreground/south-facing walls are low, broken, cut away, or fadeable;
- back/north walls may be taller;
- tall towers/arches should usually sit behind combat spaces from the camera's perspective;
- tag appropriate tall pieces for the 11A.5 occlusion system.

Do not repeat the 11A mistake of building a complete opaque rectangle around every “room”. Treat rooms like isometric game sets with camera-facing walls removed/broken.

---

## 11B.2 — Re-author Area 3 spawns around rooms and corridors

Do not leave Area 3 enemies in their old generic grid just because the coordinates still work.

Move existing authored spawns so encounters tell the level story:

- guards in corridors/doorways;
- groups inside courtyards/rooms;
- crystals in visible but spatially intentional locations;
- stronger enemies protecting landmark spaces;
- boss arena with enough maneuvering room and a strong visual backdrop.

Preserve each existing spawn's stable ID, progression meaning, HP/reward definitions and persistence identity unless there is a separate gameplay-design reason to change them.

Only change authored positions/grouping needed for the new environment.

---

## 11B.3 — Area 1 large landmarks

Add a small number of memorable structures rather than uniform clutter.

Candidate composition matching the concept direction:

- a modest village/outskirts cluster rather than a dense town;
- one central visual landmark/plaza/well/shrine-like object;
- one or two small buildings/ruined structures near roads;
- fences that organize space without becoming hard maze walls;
- a few work/camp/garden areas.

Keep large combat clearings around the existing major spawn clusters.

Paths should remain the strongest navigation cue.

---

## 11B.4 — Area 2 environmental identity

Area 2 should remain related to Area 1 but slightly darker/harsher, not merely a darker flat rectangle.

Use:

- denser/darker tree groups;
- more exposed rocks/dead vegetation;
- less maintained paths/fences;
- a few watch/camp/border structures;
- visual transition toward the fortress zone over its eastern half;
- readable south gate into Area 3.

The eastern extension of Area 2 must feel intentionally occupied rather than unused padding created only to connect Area 3.

---

## 11B.5 — Medium-scale composition pass

For all three areas, add clusters rather than random scatter:

- tree groups;
- rock groups;
- fence runs;
- ruined wall fragments;
- bushes/grass patches;
- carts/crates/barrels where contextually appropriate;
- broken beams/rubble around ruins;
- signposts and small road markers.

Use three visual scales:

1. large landmarks/boundaries;
2. medium clusters that shape spaces;
3. small dressing that removes emptiness.

Do not solve emptiness by uniformly sprinkling props over every square meter.

---

## 11B.6 — Ground variation and transitions

Improve the large flat-color floors without sacrificing readability:

- subtle grass/soil variation in Areas 1/2;
- worn ground around paths/gates/spawn spaces;
- stone/rubble surface changes inside Area 3;
- natural transitions at lake shore, mountain base and rift rim;
- no obvious rectangular area seam visible during continuous traversal.

Prefer a small number of reusable materials/textures and geometry sharing over many unique materials.

---

## 11B.7 — Asset strategy

Quaternius remains the primary art family.

Before sourcing anything new:

1. inspect what is already shipped under `public/assets/quaternius/`;
2. if the original approved Medieval Village / Stylized Nature / Fantasy Props source models are available to the Codex workspace, curate only the additional models actually required by the approved level composition;
3. resize/prepare textures consistently with the current mobile pipeline;
4. update `manifest.json`, README/provenance and license tracking;
5. do not commit source ZIP archives.

If an essential visual family genuinely does not exist in the approved packs, document that gap before introducing another CC0 family. Keep art style coherence more important than raw asset quantity.

---

## 11B.8 — Performance discipline

11B will increase static object count substantially, so preserve the existing mobile-first constraints:

- reuse loaded assets and materials;
- share geometry where practical;
- use instancing for genuinely repeated static props when profiling shows draw-call pressure;
- keep animated characters scoped to the active area;
- avoid excessive transparent overdraw from the occlusion system;
- preserve Full/Reduced render modes and Smooth/30 FPS modes;
- measure on representative phone hardware rather than assuming desktop performance.

Do not prematurely reduce environmental quality before measuring where the actual bottleneck is.

---

## 11B exit criteria

- Area 1 no longer feels empty at normal phone scale;
- Area 2 has a distinct but related darker-borderlands identity and uses its eastern extension intentionally;
- Area 3 visibly reads as a ruined fortress with rooms/corridors/courtyards rather than a flat arena inside perimeter walls;
- paths naturally connect all gates and important spaces;
- spawn placement in Area 3 matches the architecture;
- hero/enemies remain readable in every combat space;
- no tall scenery recreates the foreground occlusion failure;
- no normal camera angle exposes obvious void at world edges;
- transitions between Areas 1/2/3 remain visually continuous;
- environment richness is substantially closer to the approved concept-art composition;
- iPhone portrait playtest remains smooth/usable;
- initial load/payload stay within project budgets;
- `npm run build` and `npm run validate:release` pass;
- provide portrait screenshots from representative positions in all three areas before declaring the slice complete.

---

# Codex Cloud hand-off

Always start from the latest `origin/main` on a fresh branch. Read `AGENTS.md` and this document fully.

## Next task: implement 11A.5 only

Do not implement 11B in the same PR.

Most importantly: **do not spend another attempt trying to infer the Area 3 occlusion cause.** Treat the camera/south-wall diagnosis in this document as the starting point. Remove/rebuild the full-height foreground south wall and add the rendering-only occlusion safety net, then validate it from the listed hero positions.

Preserve the working Slice 11A topology/navigation/progression. Replace the macro visual placeholders, do not redesign gameplay.

Before opening the PR:

1. update from latest `origin/main` and ensure the diff contains only this slice;
2. increment the package version according to repository convention;
3. run `npm run build`;
4. run `npm run validate:release`;
5. visually inspect at a phone-like portrait viewport;
6. capture screenshots of north lake, west ridge, south rift, A1 side of fortress gate, A3 side of fortress gate, and at least one point deeper inside Area 3;
7. explicitly report which visible pieces use Quaternius assets and which remain procedural;
8. explicitly report whether any additional source asset is needed for 11B rather than silently substituting giant primitive geometry.
