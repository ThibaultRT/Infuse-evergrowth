# 5 — Area visual streaming

## Outcome

Make world presentation scale to many authored areas **before** production Gaea/Three.js environments are introduced.

Implement and validate the mechanism first against the existing lightweight Areas 1–3. After it is proven, replace production visuals incrementally without changing the streaming architecture.

The game must still feel like one continuous world: no loading screen, movement freeze, teleport, gameplay reset, or dependency on rendered meshes when crossing a gate.

Read `three-editor.md` before implementing this roadmap item. The production authoring contract now has two independently loadable visual chunk types:

```text
AREA CHUNK
Area_A01_Root
Area_A02_Root
...

CONNECTION / TRANSITION CHUNK
Transition_A01_A02_River
Transition_A01_A03_RuinedWall
...
```

The master Three.js Editor scene is only an authoring source. Runtime never loads one combined `AUTHORING_WORLD` GLB.

## Why this comes before environment production

The current build permanently creates every `EnvironmentView`, creates presentation objects and DOM UI for every spawn, and blocks startup on a broad list of presentation assets. That is acceptable for three cheap blockout areas but does not scale safely to many detailed GLB environments.

Establish streaming while visuals are cheap so loading/crossing regressions can be separated from later asset-cost regressions.

Doing this now also lets production Area 1, the river transition, Area 2 and later areas plug into an already-proven residency contract instead of forcing a second architecture refactor after art production begins.

## Core invariants

Streaming is a **presentation concern only**.

The following remain lightweight and authoritative regardless of visual residency:

- `GameplayRuntime`;
- hero position/current area;
- save state;
- authored area/spawn data;
- authored connection/gate data;
- gameplay collision;
- progression;
- respawn deadlines;
- combat state required by the runtime.

Do not introduce a generic ECS. Do not infer gameplay collision, spawn state, gates or progression from Three.js objects or GLB meshes.

### Collision must not stream with visuals

`three-editor.md` defines editor-only `GAMEPLAY_GUIDES` / `COLLIDER_*` helpers for future production authoring. Those helpers may later generate renderer-independent collision JSON/world data.

They do **not** change this streaming slice:

- gameplay collision remains loaded even when its area/transition visual is absent;
- unloading `Transition_A01_A02_River` must never make the river walkable;
- a failed Area 2 visual load must never remove Area 2/gameplay gate restrictions;
- this slice does not need to implement the future editor collision extractor.

## Visual chunk model

Treat runtime presentation as two related but distinct kinds of chunk.

### Area visual chunk

Examples:

```text
Area 1 procedural EnvironmentView today
Area_A01_Root GLB later
```

Contains the main environment presentation for one area.

### Transition visual chunk

Examples:

```text
A1/A2 lake/river + bridge/gate presentation
A1/A3 ruined wall + gate/rubble presentation
```

Later these become independently exported GLBs such as:

```text
transition-a01-a02-river.glb
transition-a01-a03-ruined-wall.glb
```

A transition is owned by the **connection**, not duplicated into either neighboring area.

The implementation must support a mixed migration state, for example:

```text
Area 1        → authored GLB
A1/A2 River   → procedural/current fallback
Area 2        → procedural EnvironmentView
A1/A3 Wall    → procedural/current fallback
Area 3        → procedural EnvironmentView
```

and later any of those providers can be replaced independently.

## Visual lifecycle

Area and transition visuals should support the same conceptual lifecycle:

```text
UNLOADED
   ↓
PREFETCHING / PREFETCHED
   ↓
MOUNTED
   ↓
UNMOUNTED
```

- **Unloaded:** no visual root in the scene; no draw calls from that chunk.
- **Prefetched:** required assets are requested/cached asynchronously but need not be attached to the scene.
- **Mounted:** visual root is attached and available.
- **Unmounted:** root is detached; safe owner-specific transient resources may be released.

The current gameplay area is always visually required. Gameplay must never wait for scenery; if production scenery is late or fails, a lightweight playable fallback remains available.

## Residency policy

### 1. Current area

The current gameplay area's visual is mandatory.

### 2. Transitions belonging to the current area

All transition visuals directly incident to the **current gameplay area** should normally be considered visually required/mounted.

Reason: a river, wall, cliff edge or gate is boundary scenery and may be visible from inside the current area before the hero is physically close to its gate. Waiting until gate proximity to mount the boundary itself risks obvious pop-in.

This does **not** recursively mount the whole world. A current area normally has only a small number of incident connections, and transition chunks are expected to be materially smaller than full areas.

Example while Area 1 is current:

```text
MOUNTED
Area 1
Transition A1/A2 River
Transition A1/A3 RuinedWall

NOT automatically mounted
Area 2
Area 3
Transition A2/A3
```

### 3. Destination area by gate proximity

Do not implement a naive `current area + all adjacent areas` policy. The existing topology connects Area 1↔2, Area 2↔3 and Area 1↔3, so that would still keep the whole current world mounted.

For each connection involving the current area, use hero distance to that connection/gate:

```text
far from gate      transition is still visible if incident to current area
                   destination area not mounted

approaching gate   prefetch destination area

closer to gate     mount destination area

cross gate         destination becomes mandatory current area

move away          previous area eventually unmounts
                   new current area's incident transitions become required
```

Use separate tunable thresholds with hysteresis:

- prefetch distance > mount distance;
- unmount distance > mount distance.

Choose initial values from the current camera/fog visibility and hero speed, not arbitrary permanent gameplay rules. The destination area must mount early enough that normal movement cannot expose an empty world behind the transition.

### 4. No recursive neighbor cascade

Mounting/prefetching a destination area before crossing must **not** automatically mount all transitions belonging to that destination and then all of their neighboring areas.

Before crossing, only the seam transition associated with the current approach is guaranteed by the current-area transition rule.

After the destination becomes the gameplay current area, its other incident transitions become visually required.

This keeps graph-based streaming bounded as the world grows.

## Async requirements

Loads must be deduplicated.

If repeated updates request the same visual chunk while its Promise is pending, only one underlying load should occur.

Completion must be race-safe. Example:

```text
hero approaches A1/A2
Area 2 begins prefetch/load
hero turns away
Area 2 load finishes later
```

The late completion must re-check desired residency and must not mount Area 2 just because its Promise resolved.

A failed cosmetic load must leave gameplay playable and retain a lightweight fallback.

## Rendering responsibilities

Add a focused rendering-layer service. Naming can follow existing conventions, for example:

```text
src/rendering/environment/WorldVisualStreamingManager.ts
```

or retain `EnvironmentStreamingManager` if that name remains clear.

Its responsibility is visual residency, not gameplay rules.

It receives plain information such as:

```text
areas
connections
current gameplay area id
hero world position
scene
visual provider/manifest metadata
```

and owns the mounted/prefetched state of area and transition visual providers.

`Game.ts` should construct it and synchronize other presentation from its residency snapshot; do not put the streaming algorithm directly into `Game.ts`.

## Provider abstraction

Do not tie streaming directly to today's procedural `EnvironmentView`.

Introduce a small presentation abstraction/factory that can represent both area and transition visual sources.

Conceptually the provider layer needs operations equivalent to:

```text
prefetch
create/mount
unmount/dispose safely
fallback when unavailable
```

Stable provider identity must distinguish examples such as:

```text
area:1
area:2
transition:area1-area2
transition:area1-area3
```

Later rendering metadata should be able to describe:

```text
AREA
id
world root transform
visual size
provider / GLB URL

TRANSITION
connection id
connected area IDs
world root transform
provider / GLB URL
```

Do not derive world placement from GLB contents. `three-editor.md` deliberately keeps shipping roots local at `(0,0,0)`; runtime metadata applies the explicit world transform.

Keep gameplay definitions under `src/data/areas/` renderer-independent. Rendering manifests/asset paths belong in the rendering/asset layer.

## Gate and transition presentation ownership

Production boundary scenery belongs to the transition provider.

For the future A1/A2 river this includes visual content such as:

```text
water
bridge/causeway
gate if present
seam rocks
shared river vegetation/effects
```

For A1/A3 it includes the ruined wall/gate/rubble seam.

Do not duplicate these objects inside both neighboring area GLBs.

During this first streaming implementation, preserve the existing procedural/current gate visuals and progression behavior. Structure the lifecycle so a future transition GLB can replace the fallback without another streaming redesign.

A gate must never disappear while visible/crossable because one side was unmounted. Gate progression/open state remains gameplay-authoritative.

## Boot and asset loading

Refactor the broad `BOOT_ASSETS` preload so only genuinely global, immediately required presentation assets block startup.

Area-specific and transition-specific scenery must move behind visual providers rather than requiring global preload.

Desired flow:

```text
page open
  ↓
small critical boot
  ↓
game playable
  ↓
current area + current transitions ready/fallback
  ↓
likely destination area assets continue asynchronously
```

Preserve Vite-base-aware URLs, loader deduplication and cosmetic failure fallbacks.

Do not interpret browser/network cache as visual residency: downloaded/cached assets may still be absent from the Three.js scene and GPU.

## Enemy presentation streaming

Enemy **gameplay state must not be unloaded**. Spawn/save/runtime records stay alive so HP, defeat state, respawn deadlines, progression and persistence remain correct.

The expensive presentation may be dynamic.

The current `GameplayRuntime` already scopes much enemy movement/AI work to the current gameplay area. The main additional opportunity is GPU/RAM/DOM/presentation CPU.

Refactor toward a separation such as:

```text
Spawn runtime/state
    ↓ always lightweight
Enemy presentation
    ↓ optional
Three.js EnemyView/CrystalView + mixer + world DOM
```

Create or activate enemy presentation only when:

1. its area presentation is visually relevant/mounted; and
2. the hero is within a visual activation distance, or presentation is explicitly required by a cinematic/effect.

Use activation/deactivation hysteresis so enemies do not thrash at a distance boundary. Activation distance must be comfortably beyond the camera/fog-visible range with movement safety margin.

When presentation is inactive:

- no enemy/crystal Three.js object contributes rendering work;
- no animation mixer advances;
- no target/loot/HP DOM is projected;
- per-instance presentation references may be released when safe;
- shared cached GLTF geometry/material/texture resources are not accidentally disposed.

Boss defeat/gate cinematics and other focused presentation can force an entity active before using its view.

Do not add object pooling in the first slice unless measurement shows recreation churn is significant.

## Resource ownership and disposal

Be conservative.

### Area/transition-owned resources

Examples:

- unique procedural geometry;
- unique terrain geometry;
- unique transition water/wall geometry;
- locally created materials that are not shared;
- area/transition-specific scene resources.

These may be disposed when their visual owner is truly evicted.

### Shared resources

Examples:

- shared trees;
- shared rocks;
- common characters;
- common materials/textures;
- globally cached GLTF data.

Do not destroy a shared geometry/material/texture because one area, transition or enemy presentation was removed.

Do not build a universal reference-counted asset system unless measured need justifies it. Prefer explicit ownership in the provider abstraction.

## Dynamic occlusion

`EnvironmentOcclusionManager` currently assumes a fixed root set. Refactor it to support dynamic registration/unregistration of mounted area **and transition** roots.

Remove retained references and cloned occlusion materials cleanly when a visual chunk leaves residency.

Its diagnostics must continue working.

## World UI

Do not project enemy world UI for inactive enemy presentations.

Respawn indicators remain scoped to relevant/current presentation as appropriate.

No gameplay decision may depend on DOM visibility.

## Diagnostics and measurement

Before implementation, record representative development stats at:

- Area 1 center;
- near the Area 1 → Area 2 gate;
- Area 2 center.

Record at least:

- FPS;
- draw calls;
- triangles;
- geometries;
- textures;
- active mixers.

Extend development diagnostics with:

- gameplay current area;
- mounted area visual IDs;
- mounted transition visual IDs;
- prefetched/loading visual IDs;
- active enemy presentation count;
- optionally cached visual-package count.

Keep existing renderer/occlusion diagnostics.

After implementation, repeat the same measurements. At an area center, distant areas/enemies should no longer contribute unnecessary draw/DOM work. Current boundary transitions remain available. Approaching a gate should prepare the destination area before it becomes visibly necessary. Walking away should eventually evict the previous area without losing the shared seam transition now owned by the new current area.

## Validation

Verify all three connections in both directions:

- Area 1 ↔ Area 2;
- Area 2 ↔ Area 3;
- Area 1 ↔ Area 3.

Also verify:

- current-area transitions remain visually present even when the hero is not directly beside the gate;
- destination area appears before the seam exposes empty world;
- previous area unmounts after moving sufficiently away;
- no recursive loading of every neighbor through the graph;
- locked gates;
- boss gate-opening cinematics;
- combat immediately before and after crossing;
- enemy death and timestamp-based respawn while presentation is inactive;
- hero death/resurrection;
- save/reload in each area;
- gameplay collision remains correct regardless of visual residency/failure;
- background/foreground recovery;
- WebGL context loss/recovery;
- cosmetic asset failure;
- Full/Smooth, Full/30 FPS, Reduced/Smooth and Reduced/30 FPS.

Use iPhone 12 portrait at 390×844 CSS as the minimum viewport. Performance conclusions require real constrained/mobile hardware, not desktop emulation alone.

## Non-goals for this slice

Do not:

- create or import final Gaea terrain;
- import the final Area 1 GLB;
- import production river/wall transition GLBs;
- resize/reposition gameplay areas to the production targets in `three-editor.md`;
- implement the Three.js Editor `GAMEPLAY_GUIDES` collision extractor;
- redesign collision behavior or gate topology;
- change spawn coordinates, combat or progression;
- add a generic ECS, quadtree/octree or generic open-world chunk framework;
- add a complex LOD system;
- instance every environment asset;
- optimize production textures;
- build universal asset reference counting;
- change save shape unless an unexpected correctness requirement proves it necessary.

This slice is specifically: **make area, connection-transition and enemy presentation residency scalable, seamless and measurable while gameplay remains continuously authoritative.**

## Production authoring workflow after this lands

Once the streaming mechanism is proven with the current build:

1. Use the assembled master authoring scene described in `three-editor.md`.
2. Author Area 1 terrain in Gaea and compose `Area_A01_Root` in Three.js Editor.
3. Author/edit shared transition chunks in context, e.g. `Transition_A01_A02_River` and `Transition_A01_A03_RuinedWall`.
4. Place editor-only `GAMEPLAY_GUIDES` for collision where useful; keep gameplay data independent of GLBs.
5. Export/optimize each visual chunk independently.
6. Replace only the visual providers that are ready. Area 1 can become authored while its transitions and Areas 2–3 still use procedural fallbacks.
7. Validate seams, movement collision and mobile performance.
8. Replace the river/Area 2/Area 3 providers incrementally as their production assets become ready.

Keep the established production conventions from `three-editor.md`: 1 world unit = 1 meter; +X east; -Z north; Y up; shipping roots local `(0,0,0)`; runtime applies explicit world transforms.

## Acceptance criteria

The slice is complete when:

1. `Game.ts` no longer constructs and permanently renders every environment with an `AREAS.map(...)` pattern.
2. A dedicated rendering-layer manager owns visual residency.
3. The visual model distinguishes **area providers** from **connection/transition providers**.
4. The current gameplay area is always visually available or has a playable fallback.
5. Transitions directly incident to the current gameplay area remain visually available without causing recursive world loading.
6. Destination areas prefetch/mount by gate proximity with race-safe deduplication and hysteresis.
7. Old areas can leave the scene after the hero moves away.
8. Prefetching/mounting a destination does not recursively mount all of its other neighbors.
9. Gameplay state and collision remain continuous regardless of visual residency or cosmetic load failure.
10. Enemy gameplay state remains authoritative while enemy Three.js/DOM presentation dynamically activates only when relevant/nearby.
11. Inactive enemy presentation performs no animation or world-UI projection work.
12. Occlusion supports dynamically mounted/unmounted area and transition roots without retained references/material leaks.
13. Area/transition scenery no longer all needs to block initial startup.
14. Gates remain visually and behaviorally correct across residency changes.
15. Development diagnostics expose mounted area IDs, mounted transition IDs and active enemy-presentation counts.
16. All existing crossings, progression, death/respawn, save/reload, quality settings and renderer stats still work.
17. No final Gaea/Three.js production asset or production-area coordinate resize is introduced in this change.
18. `npm run build` succeeds.
19. `npm run validate:release` succeeds.
20. Mobile portrait inspection is completed and real-device evidence is collected for performance conclusions.

When implemented, keep only stable architecture/performance rules in permanent docs and remove/update this WIP item according to the roadmap maintenance rule.