# Graphical Improvement Plan

## Purpose

This document proposes a staged graphical pass for the current two-area vertical slice. The goal is to improve identity, readability, and game feel without changing combat balance, save data, authored spawn positions, or the mobile-first controls.

The first pass should establish a reusable visual language rather than produce one-off final art. New areas, enemies, weapons, and effects should be able to build on the same data-driven rendering foundation.

## Guiding principles

1. **Readability before detail.** The hero, threats, rewards, portals, and attack types must remain easy to identify on a phone screen.
2. **Distinct areas.** Area 1 and Area 2 should be recognizable immediately through palette, terrain, props, lighting, and atmosphere—not only through HUD text.
3. **Gameplay owns truth.** Visual effects may communicate attacks, damage, rarity, and state, but must not determine gameplay timing or outcomes.
4. **Mobile performance first.** Target current iPhones and Safari, limit draw calls and transparent overdraw, reuse geometry/materials, and preserve the existing pixel-ratio cap.
5. **Progressive asset adoption.** Improve procedural Three.js visuals first where practical, then introduce optimized GLB assets and animation without requiring an engine rewrite.
6. **Accessible signaling.** Do not rely on color alone; combine color with silhouette, motion, iconography, and effects.
7. **Stable authored data.** Keep environment layout in area data and tunable visual values in dedicated configuration rather than adding area-specific branches to `Game.ts`.

## Proposed visual direction

The recommended direction is **stylized low-poly fantasy with bold silhouettes and restrained effects**. It fits the current renderer, performs well on mobile, and can make progression readable without photorealistic assets.

### Shared visual language

- Chunky, simplified shapes with a consistent scale and bevel language.
- Soft directional lighting plus readable contact shadows.
- Saturated accents reserved for damage types, loot, rarity, and interactable objects.
- Neutral environment colors behind combat UI to preserve contrast.
- Tier identity expressed through a combination of silhouette detail, ring treatment, material accent, and particles.
- Portals use destination-specific motifs plus labels/icons so direction remains clear without depending on color.

### Area 1 — Evergrowth clearing

- Warm green grass, mossy stone, young trees, roots, flowers, and pale-blue ambient haze.
- Rounded, welcoming silhouettes and brighter daylight.
- A central safe clearing with landmarks that naturally frame the enemy groups and boss route.
- Slash-weak enemies can carry visible seams, vines, or leaf-like armor that suggest cutting.

### Area 2 — Fractured grove

- Cooler ground, exposed stone, broken trunks, thorny growth, and sharper silhouettes.
- Slightly lower light, stronger rim lighting, and restrained drifting motes.
- Piercing weakness communicated through cracked armor gaps or crystal-like targets.
- The return portal at the bottom of the map should visually echo Area 1's warm palette and vegetation.

## Technical foundation

Before producing many assets, add small reusable rendering boundaries:

- `EnvironmentView` builds terrain and props from area visual data.
- `HeroView`, `EnemyView`, and `PortalView` own Three.js objects and animation state.
- `EffectManager` pools short-lived hit, death, loot, and portal effects.
- `AssetLoader` loads and caches GLB files, textures, and animation clips using URLs compatible with Vite's GitHub Pages base.
- Area definitions reference an environment theme and landmark/prop placements.
- Rendering code consumes game state and events; combat and persistence remain renderer-independent.

Avoid blocking the graphical pass on a complete architecture refactor. These boundaries can be extracted incrementally from `src/visuals.ts` and `src/game/Game.ts` as each visual feature is implemented.

## Implementation phases

### Phase 0 — Baseline and budgets

1. Capture reference screenshots from representative mobile and desktop viewports.
2. Record frame time, renderer draw calls, triangles, textures, and JS/asset payload size in both areas.
3. Define initial budgets:
   - stable 60 FPS target on a supported recent iPhone, with 30 FPS as the minimum fallback;
   - no unbounded particle allocation;
   - compressed GLB assets and small texture atlases;
   - no meaningful increase in input latency or time to first playable frame.
4. Add a development-only renderer statistics overlay or logging toggle.

**Exit criteria:** reproducible before/after measurements and agreed device/browser targets.

### Phase 1 — Area identity and navigation

1. Introduce per-area environment themes for background, fog, ground, key light, fill light, and accent colors.
2. Replace the plain ground treatment with lightweight terrain layers and reusable prop clusters.
3. Add distinct Area 1 and Area 2 prop kits.
4. Place large landmarks around entry points, bosses, and portals without obstructing movement or hiding enemies.
5. Differentiate forward and return portals with destination motifs, readable open/locked states, and subtle idle animation.
6. Validate every world label against the new backgrounds at the smallest supported viewport.

**Exit criteria:** a screenshot without HUD text is sufficient to identify the active area and the likely navigation points.

### Phase 2 — Character and enemy readability

1. Improve the hero silhouette and add visible equipped hand weapons.
2. Create a base enemy family with tier variations that add geometry or adornment instead of only changing color.
3. Give crystals a distinct idle motion and non-hostile silhouette.
4. Make each boss visually unique in scale, silhouette, material accents, and idle effect.
5. Add smooth facing interpolation while preserving immediate gameplay targeting.
6. If rigged GLB characters are adopted, support idle, locomotion, attack, hit, and death clips through `THREE.AnimationMixer`.

**Exit criteria:** the hero, standard enemies, crystals, and bosses remain distinguishable when viewed at normal mobile gameplay scale and in grayscale.

### Phase 3 — Combat feedback

1. Add weapon-class attack motion for swords, hammers, and spears.
2. Create separate impact languages:
   - blunt: short shock ring, dust, and heavy recoil;
   - slash: directional arc and brief cut streak;
   - piercing: narrow thrust trail and focused spark.
3. Add restrained hit flash, enemy hit reaction, defeat dissolve/burst, and respawn arrival effects.
4. Synchronize visible attack impact with the existing damage event; animation must not delay or duplicate damage.
5. Pool effect objects and cap simultaneous effects to avoid combat-driven garbage collection spikes.
6. Respect a reduced-motion setting by shortening or disabling camera shake, large flashes, and persistent particles.

**Exit criteria:** players can identify the attacking weapon class and whether a hit landed without reading damage text.

### Phase 4 — Rewards and progression presentation

1. Improve loot and permanent-stat gain effects while retaining the existing icons and numeric clarity.
2. Give equipment rarities consistent borders, glows, drop beams, and inventory treatments.
3. Add a short boss-defeat sequence that emphasizes portal unlocks without taking control for too long.
4. Make Area 2's doubled rewards visually noticeable but not twice as visually noisy.
5. Preserve world-label visibility synchronization across death, respawn, and area transitions.

**Exit criteria:** equipment rarity and permanent-stat gains are legible in combat and visually consistent with inventory presentation.

### Phase 5 — HUD and mobile polish

1. Establish consistent spacing, typography, panel surfaces, and icon sizing.
2. Audit safe-area insets, thumb reach, touch target sizes, and landscape behavior on iPhone.
3. Improve inventory comparison and equipped-slot clarity without covering critical combat information.
4. Check contrast, color-blind distinguishability, text scaling, and reduced-motion behavior.
5. Keep normal application UI in HTML/CSS; do not move HUD panels into the Three.js canvas.

**Exit criteria:** core controls and status information remain usable at supported viewport sizes, browser zoom/text settings, and safe-area configurations.

### Phase 6 — Optimization and release validation

1. Profile both areas during dense combat, portal transitions, boss defeat, inventory use, death, and respawn.
2. Merge compatible static geometry where it reduces draw calls without harming culling.
3. Share materials and geometry; use instancing for repeated props where beneficial.
4. Compress meshes/textures and verify texture dimensions and color spaces.
5. Test PWA installation, offline reload, GitHub Pages asset paths, Safari lifecycle restoration, and WebGL context recovery.
6. Compare final screenshots and performance measurements with the Phase 0 baseline.

**Exit criteria:** the visual pass meets the agreed performance budgets and does not regress gameplay, saves, deployment, or offline behavior.

## Suggested delivery slices

Each slice should be independently reviewable and shippable:

1. Area theme configuration and differentiated lighting/ground.
2. Area prop kits and landmarks.
3. Portal visual states and destination identity.
4. Hero silhouette plus visible equipped weapons.
5. Enemy tier silhouettes and boss treatment.
6. Weapon attacks and pooled impact effects.
7. Reward/equipment presentation.
8. HUD accessibility and mobile polish.
9. Optimization and final validation.

Do not combine all phases into one pull request. Each visible slice should include mobile screenshots, before/after comparisons, and a production build check.

## Validation checklist

- `npm run build` succeeds.
- Area 1 and Area 2 transitions still work in both directions.
- Portal lock/open behavior remains driven by gameplay state.
- Damage, cooldown, reward, loot, respawn, and save behavior are unchanged unless separately specified.
- World labels hide and reappear with entity and area state.
- Equipped weapon visuals match both hand slots and inventory state.
- No asset uses a root-relative URL that breaks the `/Infuse-evergrowth/` production base.
- The service worker precaches or runtime-caches required assets as intended.
- Mobile portrait is tested first; landscape and desktop are also checked.
- Reduced-motion and color-independent cues are verified.
- Performance is measured on real or representative constrained hardware, not inferred only from desktop results.

## Open questions

### Art direction

1. Is stylized low-poly fantasy the intended long-term art direction, or should the game target a different style such as painterly, voxel, or higher-detail fantasy?
2. Are there reference games, concept art, palettes, or existing brand assets that should guide the look?
3. Should the tone remain bright and approachable, or become darker as areas progress?
4. How visually different should adjacent areas be: variations of one world, or strongly distinct biomes?

### Characters and equipment

5. Should the hero have a fixed authored identity, player-selectable appearance, or equipment-driven appearance only?
6. Is visible armor planned, and if so, must models support modular body slots from the first character pass?
7. Should weapons appear in both hands simultaneously, and are dual-wield combinations expected to have unique animations?
8. Should enemy tiers be variants of the same creature or entirely different creatures?
9. Does every area need a unique enemy family and boss model?

### Camera and effects

10. How much camera shake, zoom, hit stop, and screen flash is acceptable for the desired game feel?
11. Should combat remain calm enough for long incremental sessions, or prioritize stronger action-game impact?
12. Should portal travel be instant with effects, or use a longer transition/loading presentation?
13. Is day/night or dynamic weather part of the intended scope?

### UI and accessibility

14. What are the minimum supported iPhone model, iOS/Safari version, screen size, and performance tier?
15. Are tablet and desktop layouts first-class targets or adaptations of the phone layout?
16. Should the game support a formal reduced-motion option, effect-intensity option, and color-blind palettes?
17. Is portrait the only preferred mobile orientation, or must landscape receive equal design attention?

### Asset production and scope

18. Will final assets be produced internally, commissioned, purchased, or generated from a reusable kit?
19. What licensing and attribution constraints apply to third-party models, textures, fonts, audio, or visual effects?
20. What download-size and initial-load targets should the installed PWA meet?
21. Should this pass include audio feedback and music direction, or remain strictly graphical?
22. Which milestone matters most for the first graphical release: area identity, character quality, combat feel, or UI polish?

Answers to these questions should be recorded at the top of this document before final asset production begins. Unanswered questions should default to the lowest-complexity, mobile-safe implementation that does not prevent later expansion.
