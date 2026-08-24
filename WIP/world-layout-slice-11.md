# Slice 11 — Continuous Multi-Area World Layout

## Purpose

This document is the implementation hand-off for the next environment pass after the approved high-level world concept.

The goal is **not** to reproduce every prop/detail from the concept art in one pass. The goal is to make the real Three.js world obey the same macro composition so it can be judged on an iPhone before we spend time on detailed dressing.

The approved visual target is a continuous stylized medieval-fantasy world with:

- **Area 1**: bright, green, sunlit meadow / village outskirts. Grass is the main ground. Roads are visual navigation and connect every exit. Do not pave the whole area.
- **Area 2**: north of Area 1 and Area 3, similar visual family to Area 1 but slightly darker/harsher. It extends substantially farther east than Area 1.
- **Area 3**: east of Area 1, medieval ruined-fortress biome. Huge ruined castle walls form its outer identity. The east boundary of Area 1 is therefore the western outer wall of Area 3.
- **Area 1 ↔ Area 2**: mostly separated by a large lake/water frontier, with one controlled fortified crossing near the north-east side of Area 1.
- **Area 1 ↔ Area 3**: large fortified opening through the ruined castle wall.
- **Area 2 ↔ Area 3**: a south gate from the eastern extension of Area 2 into the north side of Area 3.
- **Area 1 west border**: natural high terrain / mountains / stacked rocks, not a castle wall. A future Area 4 passage is visible as a sealed mountain pass.
- **Area 1 south border**: a large ground rift/chasm, not a castle wall. A future progression route is visible as a sealed/blocked crossing over the rift.
- No visible void around normal gameplay. Borders must read as believable terrain or structures.
- Gates are physical openings in those borders. The player walks through them; they must not feel like teleporters.

Devour Idle is only a reference for environment richness, readable paths, sturdy gates, and believable borders. Do not copy its assets or map.

---

## Why this should be implemented in Codex Cloud rather than directly through GitHub MCP

This slice is intentionally a coordinated runtime + authored-data + rendering change. It needs:

- TypeScript edits across several files;
- authored JSON changes;
- `npm run build`;
- ideally `npm run validate:release`;
- a running browser/mobile-size visual inspection;
- screenshots from the real game;
- iterative correction if the camera reveals gaps or occlusion.

The GitHub MCP is suitable for this plan/documentation, but committing the implementation directly to `main` without a local build and visual run is unnecessarily risky. Implement Slice 11A on a fresh Codex branch from current `origin/main`, validate it, then open a PR.

---

## Current implementation facts that Slice 11A must address

At the time this plan was authored (`package.json` 0.50.8):

1. `GameplayRuntime.updateHero()` hard-clamps every area to approximately `originX ± 17.2` and `originZ ± 27.2`. All areas therefore behave as the same 36 × 56-ish rectangle.
2. `AreaFlowSystem.crossesAdjacentBoundary()` only considers areas adjacent when their `originX` is identical and their Z origins are within 60 m. That supports a vertical chain but not east/west branching.
3. `GameplayRuntime.enterArea()` shifts the hero by 2.8 m on Z for an adjacent transition, otherwise resets to the destination origin.
4. `Game.enterArea()` explicitly resets camera position to the destination area after crossing.
5. `Game.syncAreaVisibility()` only shows the current `EnvironmentView`. The destination terrain can therefore disappear/appear at a transition rather than existing as one continuous world.
6. Current authored origins are linear: Area 1 `(0, 0)`, Area 2 `(0, -56)`, Area 3 `(0, -112)`.
7. Current gates are directional per-area definitions and `GateView` has no authored orientation/style metadata. This is insufficient for one physical gate shared by two areas and for east/west gates.
8. `EnvironmentView` currently uses a nearly full-area brick pavement for Area 1 and a relatively small decoration set. The permanent macro terrain must not be placed in a fallback group that gets hidden when Quaternius assets finish loading.

Do not paper over these issues with a visual fake followed by a position teleport. Slice 11A should establish the correct 2D world topology first.

---

# Slice 11A — World skeleton (implement now)

## 11A scope

Implement only:

- global Area 1 / 2 / 3 topology;
- per-area dimensions;
- continuous north/south/east/west traversal through real shared gates;
- no camera snap/teleport on an adjacent gate crossing;
- macro terrain and border silhouettes;
- main road network;
- lake frontier;
- Area 3 giant wall silhouette;
- west mountains/high rocks;
- south rift/chasm;
- large physical active gates;
- sealed visual future west/south exits;
- collision at the macro boundary level;
- preservation of existing progression, enemies, loot, saves, combat and equipment.

Do **not** yet spend time on detailed ruined rooms/corridors, dozens of props, dense vegetation, final gate ornament, new enemy placement, or new downloadable asset packs. Those are Slice 11B after the phone review.

---

## Target global coordinates

Use the existing coordinate convention where north is decreasing Z.

### Area 1

Keep its center/origin unchanged:

```text
origin = (0, 0)
width  = 36 m
 depth = 56 m
X range = -18 .. +18
Z range = -28 .. +28
```

### Area 2

Move and widen Area 2 so it forms the whole northern row above both Area 1 and Area 3:

```text
origin = (20, -56)
width  = 76 m
 depth = 56 m
X range = -18 .. +58
Z range = -84 .. -28
```

This is deliberate. Area 2 must extend much farther east than Area 1 so its south edge can connect independently to Area 1 and Area 3.

Keep the existing Area 2 spawn **local coordinates** for 11A. Changing its origin will move the current encounter cluster globally without changing its relative gameplay layout. The new eastern extension may feel sparse in 11A; that is acceptable until 11B.

### Area 3

Move Area 3 directly east of Area 1:

```text
origin = (38, 0)
width  = 40 m
 depth = 56 m
X range = +18 .. +58
Z range = -28 .. +28
```

Keep existing Area 3 spawn local coordinates for 11A. Its room/corridor encounter layout will be authored later in 11B.

### Resulting topology

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

This layout is the key architectural change. Do not keep Area 3 at Z = -112.

---

## Active physical connections

The exact X/Z numbers below can be nudged by up to ~2 m during visual testing, but preserve the topology and road logic.

### Connection A1 ↔ A2

Suggested world position:

```text
(x: +8, z: -28)
axis: Z boundary
opening width: ~4.5–5.5 m
```

- Place it toward Area 1's north-east side rather than dead center.
- The surrounding north border is predominantly water/lake shoreline.
- A road from the Area 1 interior must clearly curve toward this crossing and continue into Area 2.
- Use a large fortified crossing/gate presentation. Existing Quaternius brick-frame/door assets may be reused for 11A, enlarged and supported with procedural structures/rocks as necessary.

### Connection A1 ↔ A3

Suggested world position:

```text
(x: +18, z: 0)
axis: X boundary
opening width: ~4.5–5.5 m
```

- Rotate the physical gate 90° relative to a north/south gate.
- It is an opening in Area 3's gigantic ruined western fortress wall.
- The road from Area 1 must visibly terminate at/continue through this gate.

### Connection A2 ↔ A3

Suggested world position:

```text
(x: +38, z: -28)
axis: Z boundary
opening width: ~4.5–5.5 m
```

- This is the requested south gate from the eastern extension of Area 2 into Area 3.
- It should visually belong to the same ruined-fortress defensive system as Area 3.

---

## Progression semantics to preserve

Do not let the new topology allow Area 2 or Area 3 to be skipped.

Preserve the current progression sequence:

1. Area 1 starts unlocked.
2. Defeating the Area 1 boss unlocks Area 2.
3. Defeating the Area 2 boss unlocks Area 3.
4. The new Area 1 ↔ Area 3 physical gate exists from the start but remains closed/non-traversable until **Area 3 is unlocked**.
5. Once Area 3 is unlocked, both A2 ↔ A3 and A1 ↔ A3 connections become usable in both directions.

This means the Area 1 east gate is a useful visible promise of future content, but it must not bypass Area 2 progression.

Keep `save.unlockedAreas` as the progression source of truth. This slice should **not require a save schema/version migration** just to represent geometry/topology.

---

## Canonical world-connection model

The existing directional gate model becomes awkward when a single physical gate must be visible continuously from both sides. Refactor authored gate topology into a canonical physical connection concept rather than rendering duplicate directional gates.

A suitable TypeScript/domain shape is conceptually:

```ts
type WorldConnection = {
  id: string;
  areaAId: number;
  areaBId: number;
  x: number;
  z: number;
  axis: 'x' | 'z';
  width: number;
  requiredUnlockedAreaId: number;
  unlockOnBossOfAreaId?: number;
  visualStyle: 'lake-gate' | 'ruined-fortress-gate';
};
```

Exact naming is up to the implementation, but preserve these semantics:

- one stable ID per **physical** connection;
- one renderable gate per connection, not one overlapping model per travel direction;
- bidirectional traversal once open;
- `requiredUnlockedAreaId` controls whether the physical connection is open;
- `unlockOnBossOfAreaId` identifies which current boss progression event grants a new area;
- the Area 1 ↔ Area 3 connection has `requiredUnlockedAreaId: 3` but no boss-unlock responsibility of its own;
- gate visual orientation derives from `axis` or equivalent authored facing.

Recommended connections:

```text
area1-area2: requiredUnlockedAreaId 2, unlockOnBossOfAreaId 1
area2-area3: requiredUnlockedAreaId 3, unlockOnBossOfAreaId 2
area1-area3: requiredUnlockedAreaId 3, no unlockOnBossOfAreaId
```

The authored representation may live top-level in `areas.json` or in another authored world JSON if that produces a cleaner parser. Do not put this state in rendering code.

If Codex finds a substantially smaller safe refactor that still guarantees one physical gate, bidirectional continuous traversal, branching topology and correct progression, that is acceptable. Do not retain a Z-only adjacency assumption.

---

## Per-area dimensions

Make area dimensions authored data rather than hard-coded constants in `GameplayRuntime`.

A minimal shape is:

```ts
size: {
  width: number;
  depth: number;
}
```

Expose calculated bounds in the runtime/domain layer. Rendering may consume the same authored dimensions, but rendering must not become the source of truth for movement.

Remove the hard-coded `±17.2 / ±27.2` assumptions from hero movement.

---

## Continuous traversal: required behavior

The hero must not be repositioned by a visible 2.8 m nudge and must not be reset to an area origin when crossing a valid adjacent connection.

Implement boundary crossing in renderer-independent world/navigation logic.

A simple robust solution for 11A is:

1. Calculate the candidate hero position from input.
2. If it remains inside the current area's bounds, accept it.
3. If it exits a boundary, test whether the movement segment crosses an **open physical connection** attached to that area and whether the crossing coordinate is within that connection's opening width.
4. If yes, accept the candidate global position and change `currentAreaId` to the connected area. Do not teleport the hero.
5. If no open connection exists there, clamp/reject movement at the boundary.
6. Locked gates therefore behave as closed boundaries.
7. Future west/south exits remain closed boundaries because no destination area exists yet.

Use a small hero radius/margin so the hero cannot scrape through the very edge of a closed wall. Do not introduce a heavyweight physics engine for this.

For 11A, area-edge blocking plus gate openings is sufficient. Free-form collision inside Area 3 ruins belongs to 11B.

`AreaFlowSystem.crossesAdjacentBoundary()` in its current Z-only form should become unnecessary.

On an accepted crossing:

- update `currentAreaId` and `save.currentAreaId`;
- emit the existing/appropriate area-entered event;
- reset enemy provocation as today;
- update affinity/HUD state;
- persist;
- **do not** reset camera world position;
- **do not** reset hero world position;
- the normal camera follow should simply continue following the same global point.

A tiny epsilon used only to avoid repeatedly detecting the same plane is acceptable; a visible movement snap is not.

---

## Environment visibility and streaming for 11A

The three static environment chunks must visually form one world.

Do not hide every non-current `EnvironmentView` as the current code does.

For only three macro areas, the safest 11A behavior is:

- keep Area 1, Area 2 and Area 3 **static environment roots visible**;
- continue restricting enemy AI/combat/UI to the current area as today;
- keep costly animated entities scoped to the active area;
- render one physical gate per world connection;
- profile before inventing a streaming system.

If profiling later shows that all static environments are too expensive, implement neighborhood streaming only after the playable world is visually correct. Do not reintroduce visible pop/void at gates as an optimization.

---

# Macro environment specification

## Area 1 — sunlit meadow / village outskirts

### Ground

- Main ground = grass/green terrain.
- Remove the current full-area uneven-brick pavement treatment.
- Stone/dirt/rock path surfaces should occupy only roads/plazas.

### Roads

Create a readable main path network:

- central/open combat area around the current Area 1 interior;
- branch north-east to A1 ↔ A2 gate;
- branch east to A1 ↔ A3 gate;
- branch west toward the sealed mountain pass / future Area 4;
- branch south toward the sealed rift crossing / future higher areas.

Roads do not need to be perfectly straight or symmetrical. Gentle curves are preferable.

For 11A, use either repeated Quaternius `RockPath_Round_Wide` pieces or a simple procedural road mesh plus a small number of rock-path accents. Avoid hundreds of unique draw calls.

### North border / lake

Build a large blue lake across most of Area 1's northern frontier.

Important visual behavior:

- water should clearly explain why the hero cannot simply walk north anywhere;
- shoreline should be irregular enough not to look like a rectangle;
- use rocks, small islands/shore clusters, bushes and trees to break the edge;
- the only practical Area 1 → Area 2 crossing is the A1 ↔ A2 gate/causeway;
- the destination Area 2 terrain must already be visible beyond the water/gate.

A simple Three.js water surface is sufficient for 11A. No complex water shader is required.

### East border / Area 3 wall

Build a **gigantic ruined fortress wall** along the X = +18 boundary, except for the A1 ↔ A3 opening.

For 11A, silhouette matters more than bespoke assets:

- tall stone masses/towers;
- crenellation/broken upper silhouette where easy;
- damaged sections and rubble at the base;
- gate opening integrated into the wall;
- enough height that it unmistakably reads as a fortress boundary from the gameplay camera.

The current curated Quaternius runtime subset does not contain a complete final castle-wall kit. Do not block 11A waiting for new binary assets. Procedural stone geometry using the current art palette plus the existing Quaternius gate/brick assets is acceptable for the macro prototype.

### West border / mountains

No castle wall.

Create a high natural border using:

- raised/dark rock masses;
- stacked Quaternius rocks;
- cliffs/high terrain silhouette;
- pine/tree clusters;
- one visually obvious sealed pass roughly around the west-road endpoint.

The future west exit should read as **a pass through mountains**, not a medieval gatehouse through a stone city wall.

Because portrait camera occlusion can be severe, keep the tallest west-border geometry near the outer edge and validate that it does not hide the hero or central encounters.

### South border / rift

No castle wall.

Create a rift/chasm visual using a cheap layered technique rather than requiring deformable terrain:

- dark/deep surface below ground level;
- rocky/cliff edge strips on the Area 1 side;
- broken stone/earth variation;
- one narrow bridge/crossing aligned with the south road;
- crossing remains sealed/non-traversable because the destination area does not exist yet.

The rift should look fundamentally different from the west mountains and east fortress wall.

---

## Area 2 — darker borderlands

Area 2 should remain related to Area 1 but visibly harsher:

- darker/desaturated grass and earth;
- more rocks;
- some dead/dry trees mixed with healthy vegetation;
- fewer friendly village details;
- sparse watch posts / frontier props if cheap;
- enough open combat terrain for existing spawns.

Its south-west portion visually meets the lake frontier above Area 1.

Its south-east portion reaches the A2 ↔ A3 ruined-fortress gate.

Do not fill the large new eastern extension with dozens of assets yet. A convincing ground/vegetation gradient and a few macro landmarks are enough for 11A.

---

## Area 3 — ruined fortress macro silhouette

Set the environment theme to an explicit ruined-fortress theme; do not leave it as generic `flat`.

For 11A:

- giant outer stone wall on west/east/south sides and the appropriate north sections;
- active gate to Area 1 on west side;
- active gate to Area 2 on north side;
- several large ruined blocks / partial structures inside to establish scale;
- stone/rubble ground variation;
- a few open courtyards reserved for combat.

Do **not** yet construct the final room/corridor maze or move every spawn to rooms. That is 11B.

The long-term Area 3 intent for 11B is:

- ruins forming rooms of different sizes;
- corridors between damaged walls;
- spawn groups placed inside rooms/courtyards;
- guards/spawns in corridor chokepoints;
- readable paths and no frustrating camera occlusion.

---

## Gate presentation for 11A

`GateView` currently assumes one north/south orientation and one brick-frame/door style.

Extend presentation enough to support:

- authored X/Z axis/facing;
- larger scale than the current small isolated door;
- integration with boundary geometry;
- one physical gate instance per connection;
- open/closed state driven by progression, never by rendering.

Do not create unique downloadable gate art for every connection in 11A.

Suggested visual family:

- A1 ↔ A2: sturdy frontier/lake crossing; wood + stone works.
- A1 ↔ A3 and A2 ↔ A3: fortress-wall gate; heavier stone treatment.

The gate model can be reused with different surrounding macro structures for now.

---

## EnvironmentView structure

Avoid one group serving simultaneously as permanent macro geometry and a cosmetic fallback.

A useful internal split is conceptually:

```text
EnvironmentView.root
├── terrainRoot          permanent ground/water/chasm base
├── macroRoot            permanent walls/mountains/major roads
├── assetDetailsRoot     loaded Quaternius objects
└── fallbackDetailsRoot  only the objects that can be hidden after successful asset load
```

Exact names are optional. The key rule is that successful Quaternius loading must never accidentally hide lake/walls/rift/roads/terrain that define gameplay readability.

---

## Assets: 11A must stay within the current runtime catalogue

Prefer the already curated assets, including:

- `CommonTree_1`
- `CommonTree_3`
- `Rock_Medium_1`
- `Rock_Medium_2`
- `Bush_Common_Flowers`
- `Flower_3_Group`
- `Grass_Common_Short`
- `RockPath_Round_Wide`
- `Prop_WoodenFence_Single`
- `Prop_WoodenFence_Extension1`
- `Prop_Brick1`
- `Floor_UnevenBrick` only where stone flooring is intentional
- `DoorFrame_Round_Brick`
- `Door_4_Round`

Do not add the original Quaternius ZIPs.

Do not search for a new external asset pack during 11A. After the macro prototype is approved on-device, 11B can decide which additional CC0/Quaternius models are genuinely missing.

---

## Future west/south exits

Do not add fake destination areas or target IDs that resolve to non-existent areas.

For 11A these are **environment landmarks + blocked boundaries only**:

- west: sealed mountain pass representing future Area 4;
- south: sealed bridge/crossing over the rift representing a future higher area.

They should look intentional and progression-ready, but they are not entries in the traversable world-connection set until their destination areas exist.

---

## Existing gameplay that must not change

Slice 11A is an environment/topology pass. Preserve:

- all current spawn IDs;
- current per-spawn HP/reward authored ranges;
- persisted spawn rolls;
- enemy rarities and boss identity;
- combat formulas;
- aggro/attack logic;
- equipment progression and drops;
- permanent stats;
- respawn behavior;
- daily reset behavior;
- save progression;
- hero/weapon animations;
- orbit weapon behavior;
- HUD/inventory behavior.

Changing global Area 2/3 origins is expected to move their spawns with their area. Do not rebalance them in 11A.

No save reset is acceptable.

---

## Performance constraints

The approved concept is visually rich, but 11A is a **macro prototype**, not the final dressing pass.

- Use shared geometry/materials for repeated procedural boundary pieces where practical.
- Reuse cloned/cached Quaternius assets through the existing `AssetLoader`.
- Avoid hundreds of unique meshes for paths/rocks when a smaller number establishes the silhouette.
- Do not add heavy water/post-processing effects.
- Keep animated character work scoped as today.
- Preserve Full/Reduced render scale and Smooth/30 FPS modes.
- iPhone 12 portrait remains the minimum target.

Do not prematurely optimize away adjacent terrain visibility before measuring.

---

# Slice 11A acceptance criteria

The PR is ready for the user's phone review only if all of the following are true:

### Topology/traversal

- Area 1 is south-west, Area 2 spans the north, Area 3 is east of Area 1.
- The player can walk continuously A1 ↔ A2 once Area 2 is unlocked.
- The player can walk continuously A2 ↔ A3 once Area 3 is unlocked.
- The player can walk continuously A1 ↔ A3 once Area 3 is unlocked.
- Crossing an active gate does not visibly teleport/nudge the hero.
- Normal camera follow does not snap/reset on an adjacent area crossing.
- Closed/locked connections physically block crossing.
- A1 east gate cannot bypass Area 2 progression before Area 3 is unlocked.

### Environment

- Area 1 is predominantly grass, not full pavement.
- Main roads visibly connect the active gates and future exits.
- Lake/water visually blocks most of the Area 1 north frontier.
- Area 3's huge ruined wall clearly forms Area 1's east frontier.
- Area 1 west frontier reads as mountains/high rocks, not castle wall.
- Area 1 south frontier reads as a rift/chasm, not castle wall.
- No obvious sky/void strip is visible around the normal Area 1 gameplay camera.
- Destination terrain is visible through/across active gate approaches before crossing.
- Area 2 looks related to Area 1 but slightly darker/harsher.
- Area 3 clearly reads as a ruined-fortress biome even before 11B interior detailing.

### Regression / validation

- Existing save loads without reset/migration loss.
- Existing boss unlock sequence still works: A1 boss → Area 2, A2 boss → Area 3.
- Combat/enemy/loot/equipment behavior remains unchanged.
- `npm run build` passes.
- `npm run validate:release` passes if available/appropriate.
- Test at a portrait mobile viewport and attach at least screenshots of:
  - Area 1 center showing roads/borders;
  - A1 north lake/gate with Area 2 visible beyond;
  - A1 east wall/gate into Area 3;
  - A1 west mountains;
  - A1 south rift;
  - one continuous gate crossing before and after transition.

Do not declare the slice complete from a desktop build alone if the environment has not been visually inspected at phone-like portrait size.

---

# Slice 11B — after user approves 11A (do not implement yet)

11B is the environment-composition/detail pass:

1. Tune macro dimensions based on actual phone playtest.
2. Build Area 3 interior ruined rooms/corridors/courtyards.
3. Re-author Area 3 spawn positions so encounters occupy those spaces intentionally.
4. Add large landmark structures to Areas 1/2.
5. Add medium-scale tree/rock/fence/ruin clusters.
6. Add small dressing: rubble, barrels, carts, flowers, grass, broken beams, signposts, etc.
7. Inspect the broader Quaternius/CC0 catalogue only for assets that the approved layout actually needs.
8. Profile draw calls/triangles and instance repeated static details only where measured.

The user must review Slice 11A in the real game before 11B begins.

---

# Codex Cloud hand-off

Start from the latest `origin/main`; do not work from a stale branch.

Read `AGENTS.md` and this file completely. Implement **Slice 11A only**. Preserve all gameplay/save behavior except the renderer-independent world-navigation/topology changes required for continuous 2D area connections. Do not implement Slice 11B and do not source new asset packs.

Before opening the PR:

1. review the diff against current `origin/main`;
2. bump `package.json` version according to repository convention;
3. run `npm run build`;
4. run `npm run validate:release` if applicable;
5. run the app at a portrait mobile viewport and capture the acceptance screenshots listed above;
6. verify old saves/progression do not require reset;
7. open a PR containing only Slice 11A.
