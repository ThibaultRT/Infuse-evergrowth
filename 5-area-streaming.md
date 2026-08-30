# 5 — Area visual streaming

## Outcome

Make world presentation scale to many authored areas before production Gaea/Three.js environments are introduced. Implement and validate the mechanism first against the existing lightweight Areas 1–3, then replace Area 1 visually, validate it on mobile, and continue area by area.

The game must still feel like one continuous world: no loading screen, movement freeze, teleport, gameplay reset, or dependency on rendered meshes when crossing a gate.

## Why this comes before environment production

The current build permanently creates every `EnvironmentView`, creates presentation objects and DOM UI for every spawn, and blocks startup on a broad list of presentation assets. That is acceptable for three cheap blockout areas but does not scale safely to many detailed GLB environments.

Establish streaming while the visuals are cheap so loading/crossing regressions can be separated from future asset-cost regressions.

## Core invariant

Streaming is a presentation concern only.

`GameplayRuntime`, save state, authored area/spawn data, collisions, progression, respawn deadlines, gates, and area transitions remain lightweight and authoritative regardless of what is rendered.

Do not introduce a generic ECS. Do not infer gameplay collision or spawn state from Three.js objects or GLB meshes.

## Visual area lifecycle

Support the following conceptual states per area:

```text
UNLOADED
   ↓
PREFETCHING / PREFETCHED
   ↓
MOUNTED
   ↓
UNMOUNTED
```

- **Unloaded:** no environment root in the scene and no draw calls from that area.
- **Prefetched:** likely destination assets are requested/cached asynchronously but need not be attached to the scene.
- **Mounted:** the environment root is attached and visually available.
- **Unmounted:** the root is detached; safe area-owned transient resources may be released.

The current gameplay area is always visually required. Gameplay must never wait for scenery; if production scenery is late or fails, a lightweight playable fallback remains available.

## Gate-proximity policy

Do not implement a naive `current area + all adjacent areas` policy. The existing topology connects Area 1↔2, Area 2↔3, and Area 1↔3, so that policy would still keep the whole current world mounted.

Use each relevant `WORLD_CONNECTIONS` gate position and hero distance:

```text
far from gate      destination not mounted
approaching gate   prefetch destination
closer to gate     mount destination
cross gate         destination becomes mandatory current area
move away          previous area eventually unmounts
```

Use separate, tunable thresholds with hysteresis:

- prefetch distance > mount distance
- unmount distance > mount distance

Choose initial values from the current camera/fog visibility and hero speed, not arbitrary permanent gameplay rules. The destination must mount early enough that normal movement cannot expose an empty world behind the gate.

Async loading must be deduplicated and race-safe. If an area finishes loading after the hero has turned away, completion must re-check desired residency before mounting it.

## Rendering responsibilities

Add a focused rendering-layer service, for example:

`src/rendering/environment/EnvironmentStreamingManager.ts`

It owns visual area residency and receives plain area/connection/current-area/hero-position information. `Game.ts` should construct it and synchronize presentation, not contain the streaming algorithm.

Provide a small area-environment abstraction/factory so the manager is not tied to today's procedural `EnvironmentView`. It must support mixed presentation sources during migration:

```text
Area 1 → authored GLB
Area 2 → procedural EnvironmentView
Area 3 → procedural EnvironmentView
```

then later Area 2 and Area 3 can be replaced without changing the streaming mechanism.

Keep authored gameplay definitions under `src/data/areas/` renderer-independent. Rendering manifests/asset paths belong in the rendering/asset layer.

## Boot and asset loading

Refactor the broad `BOOT_ASSETS` preload so only genuinely global, immediately required presentation assets block startup. Area/environment scenery must be requested through the area presentation mechanism.

Desired flow:

```text
page open
  ↓
small critical boot
  ↓
game playable
  ↓
likely environment assets continue asynchronously
```

Preserve Vite-base-aware URLs, loader deduplication, and cosmetic failure fallbacks.

## Enemy presentation streaming

Enemy **gameplay state must not be unloaded**. Spawn/save/runtime records stay alive so HP, defeat state, respawn deadlines, progression, and persistence remain correct.

The expensive presentation may be dynamic.

The current `GameplayRuntime` already scopes enemy movement/AI work to the current gameplay area. The main additional opportunity is therefore GPU/RAM/DOM/presentation CPU rather than deleting simulation state.

Refactor toward a separation such as:

```text
Spawn runtime/state
    ↓ always lightweight
Enemy presentation
    ↓ optional
Three.js EnemyView/CrystalView + mixer + world DOM
```

Create or activate enemy presentation only when both are true:

1. its area is visually resident/relevant; and
2. the hero is within a visual activation distance, or presentation is explicitly required by a cinematic/effect.

Use activation/deactivation hysteresis so enemies do not thrash at a distance boundary. The activation distance must be comfortably beyond the camera/fog-visible range and include a movement safety margin, so enemies are ready before the player can notice them appearing.

When presentation is inactive:

- no enemy/crystal Three.js object should contribute rendering work;
- no animation mixer should advance;
- no target/loot/HP DOM should be projected;
- per-instance presentation references may be released when safe;
- shared cached GLTF geometry/material/texture resources must not be accidentally disposed.

Boss defeat/gate cinematics and other focused presentation can force an entity active before using its view.

Do not add object pooling in the first slice unless measurement shows recreation churn is significant. First prove that dynamic activation is correct and useful.

## Resource ownership and disposal

Be conservative.

Area-owned resources such as unique procedural geometries/materials or a future unique terrain may be disposed when their owner is evicted.

Shared assets such as common trees, rocks, characters, materials, or cached GLTF data must not be destroyed because one area or enemy presentation is removed.

Do not build a universal reference-counted asset system unless measured need justifies it. Prefer explicit ownership in the environment/presentation abstraction.

## Dynamic occlusion and gates

`EnvironmentOcclusionManager` currently assumes a fixed root set. Refactor it to support dynamic registration/unregistration of mounted roots. Remove retained references and cloned occlusion materials cleanly when an area leaves residency.

Gate presentation belongs to a world connection. Keep a gate visible whenever its connection is relevant to the current mounted visual region; never allow a visible/crossable gate to disappear because one side was unmounted. Gate unlock/progression semantics remain unchanged.

## World UI

Do not project enemy world UI for non-active presentations. Respawn indicators remain current/relevant-area presentation only.

No gameplay decision may depend on DOM visibility.

## Diagnostics and measurement

Before implementation, record representative development stats at:

- Area 1 center;
- near the Area 1 → Area 2 gate;
- Area 2 center.

Record at least FPS, draw calls, triangles, geometries, textures, and active mixers.

Extend the existing development diagnostics with:

- gameplay current area;
- mounted visual area IDs;
- prefetched/loading area IDs;
- active enemy presentation count;
- optionally cached area-package count.

Keep the existing renderer/occlusion diagnostics.

After implementation, repeat the same measurements. At an area center, distant area/environment/enemy presentation should no longer contribute unnecessary draw/DOM work. Approaching a gate should prepare the destination before it becomes visibly necessary. Walking away should eventually evict the previous visual area.

## Validation

Verify all three connections in both directions:

- Area 1 ↔ Area 2
- Area 2 ↔ Area 3
- Area 1 ↔ Area 3

Also verify:

- locked gates;
- boss gate-opening cinematics;
- combat immediately before and after crossing;
- enemy death and timestamp-based respawn while presentation is inactive;
- hero death/resurrection;
- save/reload in each area;
- background/foreground recovery;
- WebGL context loss/recovery;
- cosmetic asset failure;
- Full/Smooth, Full/30 FPS, Reduced/Smooth, and Reduced/30 FPS.

Use iPhone 12 portrait at 390×844 CSS as the minimum viewport. Performance conclusions require real constrained/mobile hardware, not desktop emulation alone.

## Non-goals for this slice

Do not:

- create or import the final Gaea terrain;
- import the final Area 1 GLB;
- resize/reposition gameplay areas;
- redesign collisions, spawn coordinates, gate topology, combat, or progression;
- add a generic ECS, quadtree/octree, or generic open-world chunk framework;
- add a complex LOD system;
- instance every environment asset;
- optimize production textures;
- build universal asset reference counting;
- change save shape unless an unexpected correctness requirement proves it necessary.

This slice is specifically: **make visual area and enemy presentation residency scalable, seamless, and measurable.**

## Production-area workflow after this lands

Once the mechanism is proven with the current build:

1. Author Area 1 terrain in Gaea and compose its visual scene in Three.js Editor.
2. Optimize the shipping GLB/assets.
3. Replace only Area 1's visual provider while Areas 2–3 keep their procedural fallback.
4. Measure and validate on the target phone.
5. Repeat for Area 2, then Area 3, then future areas.

Keep the established world convention for production assets: 1 world unit = 1 meter; X/Z are the ground plane; Y is elevation. Gameplay JSON remains authoritative for collisions, spawns, and gates.

## Acceptance criteria

The slice is complete when:

1. `Game.ts` no longer constructs and permanently renders every environment with an `AREAS.map(...)` pattern.
2. A dedicated rendering-layer manager owns visual area residency.
3. The current gameplay area is always visually available or has a playable fallback.
4. Destination areas prefetch/mount by gate proximity with race-safe deduplication and hysteresis.
5. Old environments can leave the scene after the hero moves away.
6. Gameplay state remains continuous regardless of visual residency.
7. Enemy gameplay state remains authoritative while enemy Three.js/DOM presentation dynamically activates only when relevant/nearby.
8. Inactive enemy presentation performs no animation or world-UI projection work.
9. Occlusion supports dynamically mounted/unmounted environment roots without retained references/material leaks.
10. Area environment assets no longer all need to block initial startup.
11. Gates remain visually correct across residency changes.
12. Development diagnostics expose visual residency and active enemy-presentation counts.
13. All existing crossings, progression, death/respawn, save/reload, quality settings, and renderer stats still work.
14. No final Gaea/Three.js production Area 1 is introduced in this change.
15. `npm run build` succeeds.
16. `npm run validate:release` succeeds.
17. Mobile portrait inspection is completed and real-device evidence is collected for performance conclusions.

When implemented, keep only stable architecture/performance rules in permanent docs and remove/update this WIP item according to the roadmap maintenance rule.