# Graphical Improvement Plan

## Purpose

This document defines the current graphical direction and staged implementation plan for Infuse: Evergrowth. The goal is to improve area identity, character readability, equipment presentation, and combat feel without letting rendering become the source of truth for gameplay.

The project remains a Three.js browser game. The graphical pass must evolve the existing architecture incrementally rather than restart it or replace Three.js with another engine.

## Resolved visual and product direction

### Art direction and world tone

- Target **higher-detail stylized medieval fantasy**, not an intentionally minimal low-poly look.
- Use recognizable medieval forms for armor, weapons, architecture, roads, ruins, fences, bridges, gates, and scenery.
- **Devour Idle RPG** is a cosmetic quality reference only. Do not copy its assets or implementation.
- Early areas should be bright and approachable; later areas may become substantially darker or harsher.
- Areas must have **strongly distinct biomes**, not merely palette variations.
- Candidate later biomes include burned forest, lava crater, farmlands, old paved roads through ruined city remains, and other strongly authored environments.
- Detail should remain readable at normal phone scale, with iPhone 12 as the minimum phone target.

### Hero and equipment presentation

- Player appearance is primarily **equipment-driven**.
- The hero should never look naked even before armor gameplay exists; use the available Quaternius Ranger outfit as the first coherent placeholder presentation.
- Design the visual character pipeline from the start for:
  - helmet/head treatment;
  - torso armor;
  - leg armor;
  - left-hand weapon;
  - right-hand weapon.
- Both equipped hand weapons must be visible simultaneously.
- Both hands are independent gameplay attack sources and their visual attack timelines must remain independently schedulable.
- Hero facing and locomotion should remain smooth while individual weapon attacks happen asynchronously.
- Orbit weapon slots should later be unlocked for trials; orbit visuals must follow gameplay state rather than create a second combat timing model.

### Enemy visual language

- Area 1 begins with **one humanoid enemy family** rather than unrelated creature models.
- Common enemies should have simple clothing/equipment; higher rarities should gain visible quality through equipment, silhouette, ornament, materials, and focused rarity accents.
- Do not use full-body rarity recoloring. Rarity must remain recognizable without depending on color alone.
- Enemy family, rarity presentation, spawn placement, and area membership remain independent authored concepts so enemies can be reused across areas.
- Crystals remain non-hostile and visually distinct from attacking enemies.
- Bosses should be visually unique through scale, silhouette, equipment, animation, and/or environment treatment rather than only tint.

### Camera, effects, pacing, and death

- The game should feel calm and readable, not like a reaction-heavy action game.
- Avoid frequent screen flashes, strong camera shake, hit-stop spam, or other tiring effects.
- Combat impact should come primarily from weapon motion, enemy reaction, contact effects, and restrained particles.
- The normal camera should follow smoothly.
- On death, the hero resurrects visually at the current area's origin; there is no travel sequence.
- There is no day/night cycle in scope.
- There is no audio in scope.

### Areas and gates

- The previous **portal** concept is superseded by **physical gates** in the product and graphical vocabulary.
- Gates are not teleporters.
- Areas should eventually be geographically adjacent portions of one continuous world, connected through a physical blocked passage at their shared boundary.
- Boss/game progression owns locked/open state. Rendering only communicates and animates it.
- Defeating the boss should visibly open the physical route to the next area.
- Gate art should match the local biome: stone arch, palisade, ruined gate, bridge barrier, fortified passage, or equivalent.
- Destination area IDs remain data-driven so later areas can have several connections.
- Historical `portal` names may remain temporarily in legacy code/data while the graphical slices are being migrated, but **new rendering APIs and new authored terminology should use `gate`**. Do not spread the legacy term further.

### Device, orientation, UI, and performance targets

- Minimum phone target: **iPhone 12**.
- Portrait is the only first-class mobile orientation for now.
- Tablet and desktop remain adaptations of the phone layout.
- Existing settings must continue supporting:
  - full/reduced render scale;
  - smooth/30 FPS modes;
  - development renderer statistics.
- Initial load target: **20 seconds maximum** on the supported target class under reasonable network conditions.
- Total downloadable game payload hard maximum: **500 MB**, while keeping the practical runtime materially smaller.
- Normal application UI remains HTML/CSS rather than Three.js canvas UI.

## Asset family decision — Quaternius

Quaternius is now the primary 3D asset family for the first graphical implementation. The selected Standard packs are CC0 1.0 and compatible with a future proprietary commercial release; attribution is not required. Keep provenance recorded anyway.

The curated runtime assets are committed under:

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

Detailed inspection notes, measured triangle counts, source-pack limitations, exact filenames, and integration recommendations live in `WIP/quaternius-assets.md`. Project-level provenance is tracked in `ASSET-LICENSES.md`.

### Important findings from the actual Standard archives

- Do **not** import or ship the original ~833 MB of source ZIP archives.
- The curated runtime subset is roughly **38 MiB unpacked** and uses textures resized to a maximum of 1024 px.
- The free Standard **Modular Character Outfits - Fantasy** archive contains only the **Peasant and Ranger** outfit families, not the full catalogue shown in promotional material.
- The free Standard **Fantasy Props MegaKit** contains a bronze sword, axe, and shield but **no hammer or spear**.
- Do not fake hammer/spear visuals using unrelated weapon classes. Keep those visuals explicitly unresolved until a suitable asset source or bespoke model is selected.
- The Universal Base Characters, Ranger/Peasant outfits, and Universal Animation Library use the same humanoid skeleton naming, including `hand_l` and `hand_r`.
- Use the **non-root-motion** UAL1 library because gameplay already owns movement and attack timing.
- Useful UAL1 clips include `Idle_Loop`, `Jog_Fwd_Loop`, `Walk_Loop`, `Death01`, `Hit_Chest`, `Hit_Head`, `Punch_Jab`, `Punch_Cross`, `Sword_Attack`, and `Sword_Idle`.
- UAL2 is available but should not be shipped until a feature actually consumes its additional clips.
- Quaternius recommends using only the base-character head under clothing. The Standard base archive provides full-body glTFs, so a later optimization pass should produce a head/eyes/skin-only derivative instead of rendering a hidden full body under every outfit.

### First approved Area 1 asset candidates

From Stylized Nature:

- `CommonTree_1`
- `CommonTree_3`
- `Rock_Medium_1`
- `Rock_Medium_2`
- `Bush_Common_Flowers`
- `Flower_3_Group`
- `Grass_Common_Short`
- `RockPath_Round_Wide`

From Medieval Village:

- `Prop_WoodenFence_Single`
- `Prop_WoodenFence_Extension1`
- `Prop_Brick1`
- `Floor_UnevenBrick`
- `DoorFrame_Round_Brick`
- `Door_4_Round`

Character/weapon proof assets:

- `Male_Ranger`
- `Male_Peasant`
- `Superhero_Male_FullBody` as a temporary base/head source
- `UAL1_Standard.glb`
- `Sword_Bronze`

`DoorFrame_Round_Brick` + `Door_4_Round` is the first approved physical gate prototype. The door should animate around a rendering-owned pivot while its locked/open state comes from gameplay progression.

## Rendering architecture

The graphical work should evolve toward these boundaries without blocking on a complete refactor:

- `AssetLoader`: resolves Vite/GitHub Pages-safe URLs, loads/caches glTF/GLB/textures/animation clips, and provides safe fallbacks.
- `EnvironmentView`: builds terrain, structures, landmarks, vegetation, and props for an area from authored visual data.
- `HeroView`: owns the hero visual rig, facing/locomotion presentation, modular equipment visibility/attachments, both hand weapon visuals, and later orbit visuals.
- `EnemyView`: renders enemy family + rarity/equipment presentation independently from area spawn configuration.
- `GateView`: renders and animates a physical area's connection from gameplay-owned lock state.
- `EffectManager`: later pools restrained hit, death, loot, resurrection, boss-defeat, and gate-opening effects.

Rendering code consumes gameplay/domain state and events. It must not calculate combat damage, cooldowns, equipment ownership, progression, respawn, or save state.

### Asset-loading rules

- Use `GLTFLoader` for the curated Quaternius assets.
- Clone rigged humanoids with `SkeletonUtils.clone`, not ordinary `Object3D.clone`.
- Load UAL1 once and share its `AnimationClip` catalogue across compatible humanoids; create one `AnimationMixer` per visible animated humanoid.
- Cache promises/assets by URL so repeated environment props do not reload files.
- Static repeated props should reuse geometry/materials and may use instancing when profiling shows value.
- Use Vite base-aware URLs; never add root-relative asset URLs that break the `/Infuse-evergrowth/` GitHub Pages base.
- Preserve existing procedural visuals as graceful fallbacks until the corresponding runtime asset is confirmed loaded.
- Cosmetic asset-loading failure must not break gameplay, saves, or area progression.
- Gameplay movement remains authoritative; root motion is not used.

## Implementation status

### Slice 1 — rendering quality controls and baseline tooling — **implemented in v0.35.0**

Implemented and should **not be redone**:

- settings wheel;
- full/reduced (70%) render scale;
- smooth/30 FPS modes;
- persisted device graphical preferences;
- development renderer-statistics toggle;
- reproducible baseline process in `WIP/graphical-baseline.md`.

Representative/physical-device measurements that remain pending should be filled in later; they are not a reason to rewrite the foundation.

### Slice 2 — initial `EnvironmentView` and Area 1 scaffold — **implemented in v0.36.0**

Implemented and should **not be discarded or restarted**:

- `EnvironmentView` rendering boundary;
- per-area `environmentTheme` wiring;
- Area 1 `sunlit-meadow` treatment and area-specific lighting;
- procedural meadow/path/ruin/fence/tree/bush placeholders;
- Area 2 legacy visual fallback;
- equipment-friendly inventory naming/UI improvements delivered in the same merged change.

Slice 2 is a **scaffold/prototype**, not the final Area 1 art. The new Quaternius pass should replace its procedural placeholders incrementally while keeping the useful architecture.

### Asset preparation — **completed**

The inspected/curated Quaternius runtime subset is now available on `main` under `public/assets/quaternius/`. The source ZIPs are not part of the runtime repository.

## Next delivery slices

Each slice must start from the latest `origin/main`, be independently reviewable, increment the package version according to `AGENTS.md`, run `npm run build`, and avoid bundling later slices prematurely.

### Slice 3A — Quaternius asset foundation + Area 1 + gate

This is the **next implementation slice**.

1. Add a reusable rendering-only `AssetLoader` with Vite-base-safe URLs and cache loaded resources/promises.
2. Consume the curated assets already committed under `public/assets/quaternius/`; do not add the original Quaternius archives.
3. Evolve the existing `EnvironmentView`; do not replace it with a new unrelated world-rendering subsystem.
4. Replace the Area 1 procedural trees, rocks, flowers/grass, fence pieces, path treatment, and selected ruin elements with the approved Quaternius candidates.
5. Keep layout/spawn/combat coordinates authoritative in existing game data. Environment art must adapt to gameplay, not silently move gameplay entities.
6. Preserve procedural fallbacks when an optional cosmetic asset fails to load.
7. Add a rendering-only `GateView` and use `DoorFrame_Round_Brick` + `Door_4_Round` as the first physical gate assembly.
8. Drive locked/open visual state from existing boss/progression state. The door may animate open in rendering but must not own the unlock condition.
9. Do **not** implement the hero or enemy character replacement in this slice.
10. Measure production payload, draw calls, triangle counts, and representative portrait performance after the asset replacement.

**Exit criteria:** Area 1 is visibly built from the curated Quaternius family rather than primitive placeholders; its existing gameplay remains unchanged; a physical gate component exists and clearly reads as locked/open from gameplay state; failure to load an optional asset leaves a playable fallback; `npm run build` succeeds.

### Slice 3B — Quaternius hero proof

1. Add `HeroView` or extract/evolve the equivalent rendering boundary rather than embedding character loading directly in `Game.ts`.
2. Use `Male_Ranger` as the first coherent hero outfit and the compatible base/head source as needed.
3. Load/share non-root-motion `UAL1_Standard.glb` animation clips.
4. Implement idle/jog locomotion presentation and smooth facing interpolation without letting animation move the gameplay entity.
5. Expose/find `hand_l` and `hand_r` attachment points and prove that both can hold separate visible objects.
6. Attach `Sword_Bronze` as the first weapon proof-of-concept to one hand with an authored orientation/offset.
7. Keep both hand attachment/timeline paths independent even if only one proper weapon model is available in this slice.
8. Do not fake hammer or spear assets.
9. Preserve a procedural hero fallback if the character asset fails to load.

**Exit criteria:** the hero uses a coherent Quaternius humanoid presentation, locomotion/facing work without root motion, both hand bones are independently usable, and one real sword attachment works without changing combat timing.

### Slice 3C — Quaternius humanoid enemies

1. Add/evolve an `EnemyView` boundary that is independent from spawn placement and gameplay state.
2. Use `Male_Peasant` as the initial Common Area 1 humanoid enemy presentation.
3. Reuse the shared UAL1 clip catalogue for idle, jog/walk, hit, and death presentation.
4. Begin rarity differentiation using available Ranger/Peasant modular pieces, focused accents, weapon/equipment presence, and silhouette changes where the free Standard assets allow it.
5. Do not claim that the free asset set provides a complete Common-through-Legendary armor progression; keep gaps explicit.
6. Keep crystals visually separate and non-hostile.
7. Preserve procedural enemy fallback when asset loading fails.
8. Profile mixer/skin cost with representative Area 1 enemy counts before expanding animated character density.

**Exit criteria:** Area 1 Common humanoid enemies use the shared Quaternius rig/animation pipeline, rarity architecture remains data-driven, crystals remain distinct/non-hostile, and the active-area animation cost is measured.

### Slice 4 — Area 2 biome + continuous adjacent-world connection

1. Give Area 2 a strongly distinct biome while retaining the same rendering architecture and asset-loading rules.
2. Make the Area 1/Area 2 boundary geographically believable from both sides.
3. Complete the migration from teleport-style portal traversal to physical gate traversal through adjacent world space.
4. Keep destination area IDs data-driven for future branching connections.
5. Remove obsolete portal visuals/labels as they are superseded; do not add new portal terminology.

**Exit criteria:** Area 1 and Area 2 are clearly distinct without HUD text, share one physical boundary, and traversal occurs through the opened route rather than a magical teleport presentation.

### Slice 5 — equipment visuals + asynchronous hand attacks

Start only after suitable hammer/spear models have been selected or created.

1. Map gameplay equipment definitions to stable visual asset IDs independently from damage/stat definitions.
2. Show both equipped hand weapons simultaneously.
3. Support independently timed left/right weapon attack presentation so different weapon speeds do not force one shared full-body attack cycle.
4. Use appropriate animation layering, local weapon motion, or upper-body treatment so locomotion can continue cleanly.
5. Preserve blunt/slash/piercing gameplay types; visuals must not invent a generic damage type.

**Exit criteria:** both hands visibly represent their equipped items and can attack on different cadences while gameplay remains authoritative.

### Slice 6 — orbit weapon trial

1. Unlock orbit slots for the planned graphical/gameplay trial.
2. Render orbit weapons hovering/following the hero.
3. Present a flying attack that leaves the orbit position, travels toward the gameplay-selected target, strikes, and returns/follows.
4. Rendering follows attack state/events and never creates an independent damage timer.

### Slice 7 — combat feedback + resurrection

1. Establish restrained attack/impact language by damage type:
   - blunt: recoil/dust/heavier follow-through;
   - slash: directional blade motion/brief trail;
   - piercing: narrow thrust/travel line/focused impact.
2. Synchronize visible impact with gameplay damage events without delaying or duplicating damage.
3. Pool and cap effects.
4. Add death/resurrection presentation at the current area origin.

### Slice 8 — rewards, boss progression, and rarity presentation

1. Improve equipment drop/permanent-stat feedback while retaining numeric clarity.
2. Keep rarity accents consistent across world and inventory presentation.
3. Give boss defeat a restrained visual payoff linked to the physical gate opening.
4. Avoid making higher rewards proportionally noisier.

### Slice 9 — portrait HUD polish

1. Audit iPhone 12 safe areas, touch targets, thumb reach, spacing, typography, and inventory readability.
2. Keep existing graphics/performance settings accessible.
3. Prepare future UI representation for helmet/torso/legs plus both hand slots without implementing nonexistent armor gameplay.
4. Keep tablet/desktop as adaptations of portrait-first UI.

### Slice 10 — optimization and release validation

1. Profile dense combat, animated humanoids, gate opening/traversal, inventory, boss defeat, resurrection, dual-hand attacks, and orbit attacks.
2. Share geometry/materials and use instancing where measurable.
3. Create the head/eyes/skin-only base-character derivative if hidden full-body skinning remains wasteful.
4. Compress/optimize meshes/textures only after measuring Safari decode/runtime tradeoffs.
5. Measure iPhone 12 normal and fallback modes.
6. Validate initial load against 20 seconds and total downloadable payload below 500 MB.
7. Maintain asset-license provenance and reject incompatible third-party content.
8. Test PWA installation/offline reload, GitHub Pages asset paths, Safari lifecycle restoration, and WebGL context recovery.

## Validation checklist

- `npm run build` succeeds for implementation changes.
- A new slice starts from latest `origin/main` and does not reintroduce prior merged slice diffs.
- iPhone 12 portrait is included in graphical validation.
- Larger iPhones remain usable; tablet and desktop adaptations do not regress.
- Area 1 and Area 2 become visually distinct strong biomes.
- New environment work uses the curated Quaternius runtime subset rather than the original source archives.
- Asset URLs work under the `/Infuse-evergrowth/` production base.
- Required assets are compatible with the PWA caching strategy.
- Optional cosmetic loading failure preserves a playable procedural fallback.
- Gameplay movement/combat/progression remains authoritative over animation and visual effects.
- Gates are physical world connections, not teleporters, and boss progression owns lock state.
- Hero visuals support helmet/head, torso, legs, left hand, and right hand attachment paths.
- Both hand visuals can eventually animate independently.
- Orbit visuals remain projections of gameplay state.
- Enemy rarity uses equipment/silhouette/material differences plus focused accents rather than full-body recoloring.
- Enemy definitions can be reused across areas independently from spawn placement.
- Crystals remain visually non-hostile.
- Normal combat avoids excessive shake, flashes, and hit stop.
- There is no dependency on day/night or audio feedback.
- Initial load is validated against the 20-second maximum.
- Downloadable payload remains under 500 MB and materially smaller where practical.
- Every third-party asset/dependency has recorded licensing compatible with proprietary distribution.
- Performance is measured on real or representative constrained hardware, not inferred only from desktop results.

## Future decisions intentionally left open

- Exact final Area 2 biome, provided it is strongly distinct from Area 1 and geographically believable at the shared gate.
- Final armor progression/catalog once armor becomes functional gameplay; the free Quaternius Standard outfits are not sufficient to assume a complete rarity ladder.
- Visual source for hammer and spear models.
- Exact hero head/body treatment after the initial Ranger proof and head-only optimization work.
- Exact orbit weapon flight paths and timing, provided rendering follows combat state rather than owning it.
- Exact later-area sequence among burned forest, lava crater, farmlands, ruined medieval city, and other candidate biomes.
- Whether later content introduces non-humanoid enemy families in addition to humanoid variants.

When one of these choices becomes necessary, prefer the option that strengthens biome identity and equipment readability while remaining compatible with iPhone 12 performance, the curated asset family, and the reusable data-driven rendering architecture.
