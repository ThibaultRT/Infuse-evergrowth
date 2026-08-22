# Graphical Improvement Plan

## Purpose

This document defines the graphical direction and staged implementation plan for the current vertical slice and the areas that follow it. The goal is to improve area identity, character readability, equipment presentation, and combat feel without letting rendering become the source of truth for gameplay.

The first graphical work should establish a reusable visual language and rendering foundation rather than produce one-off final art. New areas, enemies, weapons, armor pieces, gates, and effects must be able to build on the same data-driven architecture.

## Resolved visual and product direction

The following decisions are now the baseline for graphical work.

### Art direction and world tone

- Target **higher-detail stylized medieval fantasy**, rather than an intentionally minimal low-poly look.
- The fantasy language should remain specialized around recognizable medieval forms so armor, weapons, enemies, architecture, and scenery naturally belong together.
- Appropriate environment elements include old wooden bridges over rivers, stone walls, paved medieval roads, ruined city remains, farms, forests, and similar grounded medieval-fantasy landmarks.
- **Devour Idle RPG** is a useful cosmetic quality reference. It is not an implementation or asset-copying reference.
- Early areas should be bright and approachable. Later zones may become substantially darker or harsher when their biome calls for it.
- Candidate biome themes include burned forest, lava crater, farmlands, medieval paved roads through old city remains, and other strongly authored environments.
- Areas should have **strongly distinct biomes**, not merely palette variations of the same environment.
- Readability on a phone remains important, but detail should not be removed merely to preserve a low-poly aesthetic.

### Hero and equipment presentation

- Player appearance is primarily **equipment-driven**.
- Weapons are the only functional equipment implemented today, but the hero should not appear naked. Use a simple leather armor set as the visual placeholder until armor gameplay exists.
- The character representation must be designed from the start for visible modular equipment:
  - helmet;
  - torso armor;
  - leg armor;
  - left-hand weapon;
  - right-hand weapon.
- Both hand weapons must be visible simultaneously.
- Each hand is an independent attack source and therefore needs an independent animation timeline. A slow hammer in one hand and a fast axe in the other must be able to attack asynchronously without forcing the whole character into one shared attack cycle.
- Hero facing and locomotion should remain smooth while individual weapon attacks animate independently.
- Orbit weapon slots are currently locked in gameplay but should be unlocked for graphical/gameplay trials.
- Orbit-slot weapons should visibly hover near and follow the hero. Their attack language should feel like a flying weapon: leave the orbit position, travel toward the target, strike, and return/follow as appropriate to the eventual gameplay rules.
- Orbit visuals and animation must remain projections of gameplay state; they must not create a second combat timing model in rendering code.

### Enemy visual language

- Area 1 should begin with **variants of one humanoid enemy family** rather than many unrelated creature models.
- The Common enemy can be a simple human with basic clothing/equipment.
- Higher rarities should progressively add visible quality and threat through armor, weapons, silhouette changes, materials, adornments, and animation details.
- Rarity color should be used as an **accent**, not as full-body recoloring. For example, a Rare enemy may use the rarity color on its helmet, weapon treatment, trim, glow, or another focused element rather than becoming entirely blue.
- Rarity must remain recognizable without depending on color alone.
- Enemies should initially differ between areas to strengthen biome identity, but the content architecture must allow an enemy definition originating in Area 1 to be spawned in Area 2 or any later area.
- Enemy family, area membership, spawn placement, and rarity presentation should therefore remain separate concepts in authored data.
- Bosses should receive stronger silhouette and equipment/environment treatment than normal rarity variants.

### Camera, effects, pacing, and death

- The game should feel **calm and readable**, not like a fast-paced action game. There is no intended dodge/parry reaction loop.
- Avoid frequent screen flashes, strong camera shake, hit-stop spam, or other effects that make long incremental sessions tiring.
- Camera zoom-in/zoom-out around meaningful points of interest or major events is acceptable when restrained.
- The normal camera should smoothly follow the player rather than snapping aggressively.
- Combat impact should primarily come from weapon motion, enemy reaction, contact effects, and clear animation rather than screen-wide effects.
- On death there should be no travel sequence. The hero should play a resurrection/return animation at the area's origin location.
- There is **no day/night cycle** in scope.

### Areas and gates

- The previous **portal** concept is replaced by **gates** everywhere in the product and graphical vocabulary.
- Gates are not teleporters.
- Areas should be understood as geographically adjacent parts of one world, connected side-by-side by a physical gate or passage at their boundary.
- The forward gate remains closed until the area's boss is defeated. Boss progression/game state owns the lock state; rendering only communicates it.
- When the boss is defeated, the gate should visibly open and allow the player to continue into the neighboring area.
- Moving through a gate should feel like continuous world traversal, not portal travel or a magical teleport transition.
- Gate art should match the local architecture and biome: stone archways, palisade gates, ruined city gates, bridges with barriers, fortified passages, or equivalent forms can all implement the same gameplay concept.
- Backtracking should use the same physical area connection where allowed by progression rules.
- The data model should identify the destination area explicitly so several areas can eventually connect through multiple gates without hard-coded area-specific logic.

### Device, orientation, UI, and performance targets

- Minimum phone target: **iPhone 12**.
- Support screen sizes from iPhone 12 through current larger iPhones without assuming only high-performance devices.
- **Portrait is the only first-class mobile orientation.** Landscape does not need equal design attention.
- Tablet and desktop layouts can remain adaptations of the phone layout for now.
- Add a visible settings-wheel entry point for graphics/performance testing.
- At minimum, settings should allow testing:
  - lower rendering resolution / render scale;
  - lower frame-rate mode.
- The intended normal experience can target smooth high-quality rendering, but graphical implementation must degrade cleanly on the lower settings.
- Do not require a formal reduced-motion mode, effect-intensity setting, or color-blind palette system in this pass. Still avoid unnecessary effects and avoid using color as the only gameplay signal.
- Initial load target: **20 seconds maximum** on the supported target class under reasonable network conditions.
- Total downloadable game payload target: **500 MB maximum**. This is a hard upper boundary, not an invitation to approach it unnecessarily; assets should still be compressed and reused sensibly.

### Asset sourcing and licensing

- Assets may be produced internally or sourced from open-source projects/assets.
- Do not spend money on commissioned or purchased asset packs at this stage.
- The game's own source code is intended to remain closed-source in the future.
- Therefore, only adopt third-party code/assets whose licenses are compatible with proprietary distribution and do **not** force the game's own source code to be opened.
- Track the source and license of every imported asset. Prefer permissive licenses or public-domain/CC0 content where practical.
- Attribution requirements are acceptable only when they can be reliably satisfied in the shipped product/repository documentation.
- Do not copy assets from Devour Idle RPG; it is a visual reference only.

### Audio

- **No audio at all** is in scope: no music, ambient audio, weapon sounds, UI sounds, or audio feedback.
- Do not create architecture or asset work that depends on audio cues for readability.

### Graphical priority

The priority order for the first graphical work is:

1. **Area graphics and biome identity.**
2. **Hero appearance and equipment presentation.**
3. **Combat and weapon animation.**
4. Enemy/boss polish, rewards, and UI refinement around those foundations.

## Guiding principles

1. **Readable detail.** Pursue higher-detail medieval fantasy while preserving clear silhouettes, targets, rewards, gates, and equipment at phone scale.
2. **Strong biome identity.** Each area should be recognizable immediately through terrain, architecture, vegetation, props, lighting, palette, and atmosphere—not only through HUD text.
3. **Grounded medieval-fantasy cohesion.** Weapons, armor, humanoids, gates, roads, ruins, bridges, walls, and natural scenery should look like parts of the same world even when biomes differ strongly.
4. **Gameplay owns truth.** Visual effects may communicate attacks, damage, rarity, equipment, gate state, and progression, but must not determine gameplay timing or outcomes.
5. **Mobile performance first.** iPhone 12 is the minimum phone target. Limit draw calls, shader cost, transparent overdraw, texture memory, and animation overhead; reuse geometry/materials where useful.
6. **Progressive asset adoption.** Introduce optimized GLB assets, rigs, textures, and animation incrementally without requiring an engine rewrite.
7. **Data-driven content.** Keep area visuals, enemy families, enemy placement, rarity presentation, and gate connections authored independently enough to allow later recombination.
8. **Restrained effects.** Prefer animation and physical motion over flashes, screen shake, and visual noise.

## Proposed visual direction

### Shared visual language

- Stylized but higher-detail medieval-fantasy proportions and materials.
- Recognizable metal, leather, wood, cloth, stone, earth, vegetation, and fire/lava materials without chasing photorealism.
- Strong silhouettes and deliberate value contrast so higher-detail models remain readable at mobile scale.
- Directional lighting plus readable contact shadows, with lighting adapted per biome.
- Saturated accents reserved for rarity, damage types, rewards, important interactables, and selected biome features.
- Equipment quality conveyed through silhouette, material, ornament, and focused rarity accents rather than whole-model recolors.
- Physical gates use destination/context cues through surrounding architecture and world layout rather than magical portal language.

### Area 1 — bright medieval-fantasy starting biome

The first area should establish the grounded fantasy baseline:

- bright daylight and approachable vegetation;
- grass, dirt or paved paths, shrubs, trees, rocks, and flowers where useful;
- old stone walls, low ruins, fences, wooden structures, or a wooden bridge over water as memorable landmarks;
- readable authored paths between origin, enemy groups, boss, and the gate to Area 2;
- a humanoid enemy family whose rarity progression is visible through equipment quality;
- an architectural gate at the Area 1 / Area 2 boundary that is visibly closed until the Area 1 boss is defeated.

Area 1 should feel attractive and detailed enough to establish the game's quality bar without using the darkest themes too early.

### Area 2 — distinct neighboring biome

Area 2 should look clearly different from Area 1 while remaining physically adjacent. The exact final theme can evolve, but it should demonstrate the strong-biome system rather than merely changing the grass color.

Useful directions include denser ruined stone, old paved roadway, altered vegetation, damaged structures, or a visibly harsher natural environment. Later areas can push farther into themes such as burned forest, lava crater, farmlands, and ruined medieval city remains.

The shared boundary with Area 1 should make geographic sense from both sides. The gate and surrounding landmark should visually connect the two spaces even if the biome changes substantially beyond it.

## Technical foundation

Before producing many assets, establish reusable rendering boundaries:

- `EnvironmentView` builds terrain, water, structures, landmarks, vegetation, and props from area visual data.
- `HeroView` owns the hero model, locomotion/facing visuals, modular armor attachment points, independent hand-weapon visuals, and orbit-slot attachment/follow presentation.
- `EnemyView` renders an enemy definition plus rarity/equipment presentation independently from the area that spawned it.
- `GateView` renders a physical area's connection and its locked/open state.
- `EffectManager` pools restrained short-lived hit, death, loot, resurrection, boss-defeat, and gate-opening effects.
- `AssetLoader` loads and caches GLB files, textures, and animation clips using URLs compatible with Vite's GitHub Pages base.
- Area definitions reference an environment theme, landmarks/props, neighboring area connections, and physical gate placement.
- Rendering code consumes game state and events; combat, equipment timing, progression, and persistence remain renderer-independent.

Avoid blocking the graphical pass on a complete architecture refactor. These boundaries can be extracted incrementally from `src/visuals.ts` and `src/game/Game.ts` as each visual feature is implemented.

## Implementation phases

### Phase 0 — Baseline, device targets, and quality controls

1. Capture reference screenshots from iPhone-12-sized portrait, larger iPhone portrait, tablet, and desktop viewports.
2. Record frame time, renderer draw calls, triangles, texture memory where measurable, and JS/asset payload size in both existing areas.
3. Establish iPhone 12 as the minimum phone performance reference.
4. Define initial rendering modes exposed through a settings-wheel UI:
   - normal/full quality;
   - low-resolution/render-scale mode;
   - low-frame-rate mode, targeting 30 FPS.
5. Preserve a smooth higher-frame-rate target when the device can sustain it, without making 60 FPS on high-end hardware the only acceptable configuration.
6. Add a development-only renderer statistics overlay or logging toggle.
7. Track initial-load time against the 20-second maximum and downloadable payload against the 500 MB maximum.

**Exit criteria:** reproducible baseline measurements exist, iPhone 12 portrait is represented in validation, and the quality/FPS controls can be exercised deliberately during future graphical work.

### Phase 1 — Area identity, adjacent-world layout, and gates

1. Introduce per-area environment themes for background, fog/atmosphere, ground, water where needed, key light, fill light, and accent colors.
2. Replace the plain ground treatment with authored terrain layers and reusable medieval-fantasy prop/structure kits.
3. Give Area 1 a detailed bright starting-biome treatment with recognizable landmarks.
4. Give Area 2 a strongly different biome treatment while preserving a believable shared boundary with Area 1.
5. Replace all portal visuals and terminology with a physical `GateView`.
6. Position Area 1 and Area 2 conceptually/geographically side-by-side and place the gate at their shared boundary.
7. Give the forward gate clearly readable locked and open states driven by boss progression.
8. On boss defeat, animate the physical gate opening without a teleport or magical travel sequence.
9. Allow traversal through the opened boundary into the adjacent area; keep destination area IDs data-driven for future multi-gate layouts.
10. Validate every world label against the new backgrounds at the smallest supported portrait viewport.

**Exit criteria:** screenshots without HUD text clearly identify each area; the shared gate reads as a physical blocked passage; defeating the boss visibly opens the route to the next area without teleportation.

### Phase 2 — Hero model and modular equipment

1. Replace the placeholder/naked-looking hero presentation with a coherent medieval-fantasy base character wearing simple leather placeholder armor.
2. Build attachment/visibility support for modular helmet, torso armor, and leg armor from the first character implementation even if armor has no gameplay stats yet.
3. Show equipped weapons in both hand slots simultaneously.
4. Keep left- and right-hand attack animations independently schedulable so different weapon speeds can animate asynchronously.
5. Add smooth facing interpolation and locomotion without coupling hero rotation to a single attack animation timeline.
6. Unlock orbit slots for trials and implement their visual attachment/follow behavior.
7. Give orbit weapons a flying attack presentation that can leave the orbit/follow position, travel toward a target, attack, and return according to gameplay events.
8. Keep all attachment points and animation state in the view layer while equipment ownership, cooldowns, and attack timing remain in domain/system state.

**Exit criteria:** the hero is visually coherent without functional armor, all planned modular slots have a technical attachment path, both hand weapons can visibly attack on different cadences, and orbit weapons can be trialed without rendering logic owning combat outcomes.

### Phase 3 — Enemy family, rarity, and cross-area reuse

1. Build Area 1 around one base humanoid enemy family.
2. Establish a Common presentation with simple clothing/equipment and an intentionally modest silhouette.
3. Add Uncommon and higher-rarity variants through progressively better armor, visible weapons, ornament, silhouette changes, and selective rarity-color accents.
4. Avoid full-body rarity recoloring. Use accents such as helmet details, weapon treatments, trim, gems, cloth, or restrained effects.
5. Preserve non-color rarity cues for readability.
6. Keep enemy definition/family independent from area spawn configuration so an Area 1 enemy can later be authored into Area 2 without cloning rendering logic.
7. Give Area 2 a different initial enemy family or visual treatment to strengthen biome identity while preserving the cross-area reuse capability.
8. Give crystals a distinct non-hostile silhouette and idle motion.
9. Make bosses visually unique through scale, silhouette, equipment, animation, and/or environment-linked details rather than only a rarity tint.

**Exit criteria:** enemy rarity is recognizable from model/equipment treatment at normal phone scale, and the authored content model can spawn the same enemy definition in multiple areas.

### Phase 4 — Combat and resurrection animation

1. Add weapon-class attack motion for swords, hammers, spears, axes, and other implemented weapon classes as they become available.
2. Ensure animation design works with independent left-hand, right-hand, and orbit attack sources.
3. Create restrained impact languages:
   - blunt: physical recoil, dust/contact ring, heavier weapon follow-through;
   - slash: directional blade motion and brief cut trail;
   - piercing: narrow thrust/travel line and focused impact;
   - future weapon classes should extend the same event-driven system rather than add screen-wide effects.
4. Avoid frequent screen flashes, large shake, or excessive hit stop.
5. Use enemy reaction, weapon motion, contact effects, and limited particles as the primary feedback.
6. Synchronize visible impact with existing gameplay damage events; animation must not delay or duplicate damage.
7. Pool effect objects and cap simultaneous effects to avoid combat-driven allocation spikes.
8. Add a death/resurrection presentation that restores the hero visually at the current area's origin location, with no travel sequence.
9. Keep smooth camera follow during normal play; use restrained zoom only for meaningful points of interest or major progression beats where it improves presentation.

**Exit criteria:** players can identify which independent weapon source attacked and whether it connected without relying on screen flashes or damage text; death clearly resolves into resurrection at the area origin.

### Phase 5 — Rewards and progression presentation

1. Improve loot and permanent-stat gain effects while retaining numeric clarity.
2. Give equipment rarities consistent focused accents across world drops and inventory presentation.
3. Add a short boss-defeat presentation that emphasizes the physical gate unlocking/opening without taking control for too long.
4. Avoid making higher rewards proportionally noisier on screen.
5. Preserve world-label visibility synchronization across death, resurrection, enemy respawn, gate state, and area traversal.

**Exit criteria:** equipment rarity and permanent-stat gains are legible in combat, and boss progression has a clear visual payoff through the newly opened route.

### Phase 6 — HUD and portrait-mobile polish

1. Establish consistent spacing, typography, panel surfaces, and icon sizing around the portrait layout.
2. Audit iPhone 12 safe-area insets, thumb reach, touch target sizes, and the largest current iPhone sizes.
3. Add the settings-wheel control and simple graphics/performance settings needed for low-resolution and low-FPS testing.
4. Improve inventory comparison and equipped-slot clarity without covering critical combat information.
5. Ensure helmet/torso/legs and both hand slots have a future-proof UI representation even if armor functionality arrives later.
6. Treat tablet and desktop as adaptations of the portrait-first phone UI rather than separate first-class designs.
7. Keep normal application UI in HTML/CSS; do not move HUD panels into the Three.js canvas.

**Exit criteria:** the game is comfortable and readable from iPhone 12 upward in portrait, performance modes can be switched from the UI, and larger devices remain usable without requiring dedicated layouts.

### Phase 7 — Optimization, asset compliance, and release validation

1. Profile both areas during dense combat, gate opening/traversal, boss defeat, inventory use, death/resurrection, orbit attacks, and simultaneous dual-hand attacks.
2. Merge compatible static geometry where it reduces draw calls without harming culling.
3. Share materials and geometry; use instancing for repeated vegetation/props where beneficial.
4. Compress meshes and textures, validate texture dimensions/color spaces, and avoid oversized source assets in the shipped bundle.
5. Measure the iPhone 12 experience in both normal and fallback settings.
6. Verify initial load remains within the 20-second target and total downloadable payload remains below 500 MB.
7. Maintain an asset-source/license inventory and reject dependencies/assets that would force proprietary game source code to become open source.
8. Test PWA installation, offline reload, GitHub Pages asset paths, Safari lifecycle restoration, and WebGL context recovery.
9. Compare final screenshots and performance measurements with the Phase 0 baseline.

**Exit criteria:** the graphical pass meets the device, load, payload, licensing, and gameplay constraints without regressions to saves, deployment, controls, or combat state.

## Suggested delivery slices

Each slice should be independently reviewable and shippable:

1. Rendering quality controls and baseline measurements.
2. Area 1 environment quality pass.
3. Adjacent Area 2 environment and shared physical boundary.
4. Portal-to-gate conversion and boss-driven gate-opening presentation.
5. Hero base model with leather placeholder armor and modular armor attachment points.
6. Simultaneous visible hand weapons with asynchronous attack animation support.
7. Orbit-slot trial unlock plus hovering/flying weapon presentation.
8. Humanoid enemy rarity variants with equipment-driven visual progression.
9. Area 2 enemy treatment and cross-area enemy reuse validation.
10. Weapon-class attacks, restrained hit effects, and resurrection animation.
11. Rewards/equipment presentation and boss gate-opening sequence.
12. Portrait HUD/performance settings polish.
13. Optimization, licensing audit, and final validation.

Do not combine all phases into one pull request. Each visible slice should include portrait-mobile screenshots, before/after comparisons where relevant, and a production build check when code is changed.

## Validation checklist

- `npm run build` succeeds for implementation changes.
- iPhone 12 portrait is included in graphical validation.
- Larger iPhones remain usable; tablet and desktop adaptations do not regress.
- Portrait is treated as the primary/required mobile orientation.
- Area 1 and Area 2 are visually distinct strong biomes.
- Area 1 and Area 2 are connected by a physical gate rather than a teleporting portal.
- The gate remains closed until the relevant boss is defeated and visibly opens from gameplay progression state.
- Area traversal does not use a portal/teleport animation.
- Death returns/resurrects the hero at the area's origin with an appropriate animation.
- Hero visuals support helmet, torso, legs, left hand, and right hand attachment points.
- Both equipped hand weapons are visible and can animate asynchronously.
- Orbit-slot weapons can hover/follow and perform a flying attack presentation during trials.
- Enemy rarity uses equipment/silhouette/material differences plus focused color accents rather than full-body rarity recoloring.
- Enemy definitions can be reused across areas independently from spawn placement.
- Crystals remain visually non-hostile.
- Camera follow is smooth and normal combat avoids excessive shake, flashes, and hit stop.
- There is no dependency on a day/night system or audio feedback.
- The settings wheel exposes low-resolution and low-FPS test modes.
- No asset uses a root-relative URL that breaks the `/Infuse-evergrowth/` production base.
- Required assets are compatible with the PWA caching strategy.
- Initial load is validated against the 20-second maximum.
- Downloadable payload remains under 500 MB and is kept materially smaller where practical.
- Every third-party asset/dependency used for the graphical pass has recorded licensing compatible with future proprietary source code.
- Performance is measured on real or representative constrained hardware, not inferred only from desktop results.

## Future decisions intentionally left open

The major art-direction questions for the first pass are resolved. The following details can remain implementation choices until their corresponding slice is designed:

- the exact Area 2 biome, provided it is strongly distinct from Area 1 and geographically believable at the shared gate;
- the exact visual design of the hero beneath modular equipment;
- the final armor progression/catalog once armor becomes functional gameplay;
- exact orbit weapon flight paths and timing, provided rendering follows combat state rather than owning it;
- exact later-area sequence among burned forest, lava crater, farmlands, ruined medieval city, and other candidate biomes;
- whether later content introduces non-humanoid enemy families in addition to humanoid variants.

When one of these choices becomes necessary, prefer the option that strengthens biome identity and equipment readability while remaining compatible with iPhone 12 performance and the reusable data-driven rendering architecture.
