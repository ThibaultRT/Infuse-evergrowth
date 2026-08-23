# Graphical Improvement Plan

## Status

Graphical slices **1 through 9 are implemented** on `main`.

The historical step-by-step instructions for those completed slices are no longer useful as active implementation guidance. This document now keeps only:

- durable visual/product direction;
- asset and rendering rules that future work must preserve;
- a compact record of completed graphical milestones;
- the remaining **Slice 10 — optimization and release validation** work;
- still-open visual decisions.

Detailed Quaternius asset inspection/provenance remains in `WIP/quaternius-assets.md` and `ASSET-LICENSES.md`.

## Durable visual direction

### Art direction and world tone

- Target **higher-detail stylized medieval fantasy**, not intentionally minimal low-poly art.
- Use recognizable medieval forms for armor, weapons, architecture, roads, ruins, fences, bridges, gates, and scenery.
- Devour Idle RPG is a cosmetic quality reference only. Do not copy its assets or implementation.
- Early areas should be bright/approachable; later areas may become darker or harsher.
- Areas must have strongly distinct biomes, not palette swaps.
- Candidate later biomes include burned forest, lava crater, farmlands, paved roads through ruined city remains, and other strongly authored environments.
- Detail must remain readable at normal phone scale; iPhone 12 portrait is the minimum first-class phone target.

### Hero and equipment presentation

- Player appearance is primarily equipment-driven.
- Preserve visual attachment paths for helmet/head, torso, legs, left-hand weapon, and right-hand weapon.
- Both equipped hand weapons must remain visible simultaneously.
- Left/right attack presentation must remain independently schedulable because gameplay hands are independent attack sources.
- Hero locomotion/facing remains smooth while attacks occur asynchronously.
- Orbit weapons are projections of gameplay attack state, never an independent visual damage timer.

### Enemy visual language

- Enemy family, rarity presentation, area membership, and spawn placement remain independent authored concepts.
- Rarity should use equipment, silhouette, materials, ornament, and focused accents rather than full-body recoloring.
- Rarity must remain recognizable without depending on color alone.
- Crystals remain visually distinct and non-hostile.
- Bosses should be unique through scale, silhouette, equipment, animation, and/or environmental treatment rather than tint alone.

### Camera, effects, pacing, and death

- Combat should stay calm and readable rather than reaction-heavy.
- Avoid frequent flashes, strong camera shake, hit-stop spam, or other tiring effects.
- Impact should come primarily from weapon motion, enemy reaction, restrained contact effects, and capped particles.
- Normal camera follow remains smooth.
- Hero resurrection happens visually at the current area's origin; there is no travel sequence.
- No day/night cycle or audio dependency is currently in scope.

### Areas and gates

- **Gate** is the product/rendering term. Historical `portal` terminology is obsolete for new code/data/docs.
- Gates are physical adjacent-world connections, not teleporters.
- Boss/progression state owns locked/open state. Rendering communicates and animates it only.
- Destination area IDs remain data-driven so future areas may have branching connections.
- Gate art should match the local biome: stone arch, palisade, ruined gate, bridge barrier, fortified passage, or equivalent.

## Quaternius asset rules

Quaternius remains the primary 3D asset family for the current graphical implementation.

Curated runtime assets live under:

```text
public/assets/quaternius/
├── animations/
├── characters/
├── licenses/
├── nature/
├── village/
├── weapons/
├── manifest.json
└── README.md
```

Rules to preserve:

- do not commit or ship the original source ZIP archives;
- load curated glTF/GLB assets with Vite/GitHub-Pages-safe URLs;
- clone rigged humanoids with `SkeletonUtils.clone`;
- share compatible animation clip catalogues and keep one mixer per visible animated humanoid;
- gameplay owns movement and attack timing; do not use root motion as gameplay authority;
- cache loaded assets/promises;
- reuse geometry/materials and consider instancing only when profiling justifies it;
- cosmetic asset-loading failure must preserve a playable fallback;
- keep asset provenance/licensing recorded.

The free Standard packs do not imply a complete final armor/weapon catalogue. Do not invent unavailable assets or claim a complete rarity ladder from the current Quaternius subset.

## Rendering boundaries

Preserve and evolve these boundaries rather than moving gameplay rules back into rendering:

- `AssetLoader`: base-aware asset resolution/loading/cache/fallbacks;
- `EnvironmentView`: terrain, structures, landmarks, vegetation, props;
- `HeroView`: hero rig, locomotion/facing, equipment attachments, hand/orbit presentation;
- `EnemyView`: enemy family + rarity/equipment presentation independent from authored spawn placement;
- `GateView`: physical gate presentation driven from gameplay lock state;
- `EffectManager`: restrained/poolable hit, death, loot, resurrection, boss, and gate effects.

Rendering consumes state/events. It must not calculate combat damage, cooldowns, ownership, progression, respawn, or save state.

## Completed graphical milestones

### Slice 1 — quality controls and baseline tooling — complete

- Full/Reduced render scale;
- Smooth/30 FPS modes;
- persisted graphical preferences;
- development renderer statistics.

The old standalone `WIP/graphical-baseline.md` procedure has been retired. Permanent performance constraints are now in `AGENTS.md` and the remaining validation work is below.

### Slice 2 — EnvironmentView scaffold — complete

- `EnvironmentView` boundary;
- per-area environment themes/lighting;
- initial Area 1/Area 2 environment treatment;
- equipment-friendly inventory naming/UI foundation.

### Slice 3A — Quaternius environment + gate foundation — complete

- reusable Quaternius asset-loading foundation;
- curated Area 1 environment assets;
- physical gate rendering driven from progression state;
- graceful cosmetic fallbacks.

### Slice 3B — hero proof — complete

- Quaternius Ranger hero presentation;
- shared non-root-motion animation use;
- smooth facing/locomotion presentation;
- independent hand attachment paths.

### Slice 3C — humanoid enemies — complete

- Quaternius humanoid enemy presentation;
- shared animation pipeline;
- data-driven rarity presentation foundation;
- crystals remain separate/non-hostile.

### Slice 4 — Area 2 biome + continuous world connection — complete

- visually distinct Area 2;
- geographically adjacent Area 1/Area 2 boundary;
- physical gate traversal instead of teleport presentation.

### Slice 5 — equipment visuals + asynchronous hand attacks — complete

- visible equipped hand weapons;
- independent left/right attack presentation;
- visual item mapping remains separate from gameplay damage definitions.

### Slice 6 — orbit weapon trial — complete

- orbit slots/visuals;
- gameplay-driven outbound strike/return presentation.

### Slice 7 — combat feedback + resurrection — complete

- restrained damage-type-specific impact language;
- event-driven combat effects;
- hero death/resurrection presentation.

### Slice 8 — rewards, boss progression, rarity presentation — complete

Merged in PR #22 / `feat: polish rewards and portrait HUD`.

- improved equipment/permanent-stat reward feedback;
- coherent rarity accents;
- restrained boss/gate payoff.

### Slice 9 — portrait HUD polish — complete

Merged in PR #22 / `feat: polish rewards and portrait HUD`.

- portrait-first spacing/readability improvements;
- graphics/performance settings retained;
- inventory/equipment presentation prepared for armor + hand/orbit slots.

## Slice 10 — optimization and release validation — remaining

This is the **next graphical slice**.

1. Profile dense combat, animated humanoids, gate opening/traversal, inventory, boss defeat, resurrection, dual-hand attacks, and orbit attacks.
2. Share geometry/materials and use instancing where measurable.
3. Create a head/eyes/skin-only base-character derivative if hidden full-body skinning remains wasteful.
4. Compress/optimize meshes/textures only after measuring Safari decode/runtime tradeoffs.
5. Measure iPhone 12 portrait in normal and reduced/battery-saver modes on representative constrained hardware.
6. Validate initial load against the **20-second maximum**.
7. Validate total downloadable payload remains below **500 MB** and materially smaller where practical.
8. Validate asset provenance/licensing remains complete.
9. Test PWA installation/offline reload, GitHub Pages asset paths, Safari lifecycle restoration, and WebGL context recovery.
10. Run `npm run build` and ensure graphical optimization does not alter gameplay rules/saves.

### Slice 10 exit criteria

- representative iPhone 12 portrait performance is measured rather than inferred from desktop results;
- known dense-combat/rendering hotspots are profiled and only measured bottlenecks are optimized;
- no cosmetic loading failure can break gameplay/progression;
- initial load and payload remain inside the project budgets;
- PWA/GitHub Pages/Safari lifecycle behavior is validated;
- asset licensing/provenance remains complete;
- `npm run build` succeeds.

## Validation checklist for future graphical changes

- iPhone 12 portrait remains a first-class validation target.
- larger phones/tablets/desktop remain usable adaptations.
- asset URLs work under `/Infuse-evergrowth/`.
- optional cosmetic failures retain playable fallbacks.
- gameplay movement/combat/progression remains authoritative over animation/effects.
- gates remain physical world connections owned by progression state.
- both hand visuals remain independently schedulable.
- orbit visuals remain projections of gameplay state.
- rarity is not communicated only through full-body color.
- crystals remain visibly non-hostile.
- combat avoids excessive shake/flashes/hit-stop.
- performance claims come from representative hardware measurements.

## Future decisions intentionally left open

- final armor progression/catalog as new equipment families are added;
- exact hero head/body optimization after profiling;
- exact later-area biome sequence;
- whether later content introduces non-humanoid enemy families;
- additional gate/environment archetypes for future branching world connections.

When one of these choices becomes necessary, prefer the option that strengthens biome identity and equipment readability while staying compatible with iPhone 12 performance, the curated asset family, and the data-driven rendering architecture.
