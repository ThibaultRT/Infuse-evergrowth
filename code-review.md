# Code review

Reviewed on 2026-09-12, starting from `fd8a033`. Fixes are included in **0.72.1**. Scope: gameplay/runtime, saves, equipment and Soul Catcher, input/UI, rendering and asset loading, and build/PWA configuration.

## 1. Fixed

- **One malformed spawn could erase all progression.** Accessing a missing `roll.reward` threw inside save migration, which returned an entirely fresh save. Invalid rolls now regenerate individually while retaining the player's stats, equipment, kill counts, and deadlines. [save.ts](src/save.ts)
- **Balance edits could reroll an existing life.** Loading compared a saved reward against today's authored ranges. Valid saved HP/reward rolls now survive content changes until revival, explicit reset, or midnight, as required by the gameplay invariant. [save.ts](src/save.ts)
- **Invalid saved numbers could break stats or stall loading.** Numeric sources and equipment counters are normalized individually; Soul Catcher levels are checked against authored nodes and maximum levels. Missing historical XP is computed with an arithmetic sum instead of iterating an unchecked saved level count. [save.ts](src/save.ts)
- **Restoring equipment could duplicate the same owned weapon across slots.** Migration now keeps each item in at most one compatible slot, matching normal equip behavior. [save.ts](src/save.ts)
- **Unavailable browser storage could stop startup or interrupt gameplay.** Storage access and writes now fail safely, the game shows a saving warning, and unreadable progress is not overwritten. Graphics settings still apply when their storage write fails. [save.ts](src/save.ts), [Game.ts](src/game/Game.ts), [RenderingQuality.ts](src/rendering/RenderingQuality.ts)
- **Reloading at zero HP produced a living hero.** Runtime initialization now resumes the death countdown before allowing movement or combat. [GameplayRuntime.ts](src/game/GameplayRuntime.ts)
- **Flat defense ignored most persistent sources.** Combat read only `additive.soulCatcher`, which could also be undefined. It now evaluates the complete persistent defense stat and adds matching equipped armor. [EquipmentSystem.ts](src/systems/EquipmentSystem.ts)
- **Movement could stick after switching away from the game.** Reset now clears keyboard input; blur, hiding the page, and lost pointer capture release movement. Additional fingers no longer take over or cancel the active joystick. [InputController.ts](src/controllers/InputController.ts)
- **A missing terrain texture could prevent every world chunk from mounting.** Each missing texture now falls back independently to an untextured material, preserving the playable world. [WorldMaterials.ts](src/rendering/environment/WorldMaterials.ts)
- **Reduced resolution did nothing on DPR-3 phones.** The DPR cap now applies before the 70% scale: Full uses DPR 2 and Reduced uses DPR 1.4, reducing buffer pixel count by about 51%. [RenderingQuality.ts](src/rendering/RenderingQuality.ts)
- **Equipment changes and enemy unloading leaked GPU resources.** Replaced procedural weapons now dispose their geometry/materials; cloned humanoids release their private skeleton textures while preserving shared asset resources. [HeroView.ts](src/rendering/HeroView.ts), [AnimatedHumanoidView.ts](src/rendering/AnimatedHumanoidView.ts), [RenderingResourceDisposal.ts](src/rendering/RenderingResourceDisposal.ts)
- **Reward and stat feedback could misrepresent gains.** Slash, Piercing, and Speed gains no longer display a Blunt icon. Stat multipliers retain decimals, so a 1.05× bonus no longer appears as 1×. [ui.ts](src/ui.ts)

Validation: `node scripts/validate-code-review.mjs` covers 13 focused regressions, including supported save versions v7–v18. Build/release checks and browser smoke results are recorded below. These fixes retain save schema v18; they do not introduce new saved fields.

## 2. Improvements requiring your supervision

Ordered with gameplay/design decisions first. These changes have not been implemented.

1. **Define what percentage attack upgrades multiply.** `attackProfile()` currently adds weapon damage to an already multiplied permanent hero stat. Consequently, a “+5% outgoing damage” upgrade can increase the total hit by much less than 5%. Decide whether it applies to the permanent stat or the complete weapon attack; I recommend the complete typed hit if the current wording is retained. This changes balance and needs matching combat/HUD rules. [EquipmentSystem.ts](src/systems/EquipmentSystem.ts), [4-soul-catcher.md](4-soul-catcher.md#percentage-outgoing-damage)

2. **Clarify Ascend overflow accounting.** For Common equipment, levels 100 and 101 both ascend to level 1; ascending at 100 and then collecting one copy instead reaches level 2. Decide whether the threshold includes the retained item and how excess copies carry over. I recommend preserving excess copies consistently so purchase order does not change their value. [EquipmentProgression.ts](src/domain/items/EquipmentProgression.ts)

3. **Specify the orbit-slot unlock sequence.** Only Orbit 1 is gated by Area 2; Orbit 2 and Orbit 3 are available from the start in both equip validation and the slot picker. Confirm whether this is intentional or define each slot's unlock condition in one shared rule. [EquipmentSystem.ts](src/systems/EquipmentSystem.ts), [save.ts](src/save.ts), [ui.ts](src/ui.ts)

4. **Choose a consistent pause policy.** Inventory, settings, and Soul Catcher panels leave combat running. Losing the WebGL context also leaves simulation running while the player cannot see it. Decide which situations pause movement/combat and which timers should continue; I recommend a shared pause policy that preserves wall-clock spawn deadlines. [Game.ts](src/game/Game.ts)

5. **Finish the state/command boundary before adding more systems.** `GameCommands` accepts an injected save but calls equipment/reset helpers that mutate the global save. `Game.ts` still contains combat consequences and most UI coordination, while `AreaFlowSystem` duplicates unused boss-unlock logic. I recommend incremental extraction into existing systems, passing the authoritative state explicitly and removing duplicate paths. [GameCommands.ts](src/game/GameCommands.ts), [EquipmentSystem.ts](src/systems/EquipmentSystem.ts), [AreaFlowSystem.ts](src/systems/AreaFlowSystem.ts)

6. **Centralize progression projections before authoring more Soul Catcher layers.** Stats UI independently recalculates soul yields, effective chances, and other progression values. Percentage attack effects also overwrite the previous Soul Catcher multiplier rather than accumulating multiple nodes of the same type. The current content has one such node per type; agree on stacking rules and expose one system-produced snapshot before expanding it. [ui.ts](src/ui.ts), [SoulCatcherSystem.ts](src/systems/SoulCatcherSystem.ts)

7. **Define save recovery and simultaneous-tab behavior.** An unreadable JSON payload still becomes a fresh game, and multiple open tabs can overwrite each other's progress. The storage-failure guard fixes exceptions, not these policies. I recommend retaining a recoverable previous save and selecting one active writer; decide the recovery experience and whether multiple live tabs are supported. [save.ts](src/save.ts)

8. **Make asset updates and offline coverage deliberate.** The PWA uses fixed-name `CacheFirst` caches for mutable world/Quaternius URLs, so new code can run with old visual assets until cache expiry. The current `assets/models/` enemies and crystals also lack an explicit offline runtime cache. I recommend versioned asset URLs or manifests and a defined offline asset set, with an upgrade test before changing the caching policy. [vite.config.ts](vite.config.ts), [version.ts](src/version.ts), [AssetLoader.ts](src/rendering/AssetLoader.ts)

9. **Extend validation into the release workflow.** CI currently builds but does not run `validate:release`. Spawn/equipment/Soul Catcher content relies heavily on type assertions, and broad gameplay regression coverage remains planned. The focused checks added here reuse the existing Vite harness; agree on the long-term test setup and add content validation plus release checks to CI. [deploy-pages.yml](.github/workflows/deploy-pages.yml), [0-gameplay-remarks.md](0-gameplay-remarks.md)

## Verification

- **Passed:** 13 focused regression checks; strict TypeScript/Vite production build; world layout, crossings, asset promotion, and release validation.
- **Passed in an isolated Chromium profile:** 390×844 mobile viewport at DPR 3; Soul Catcher node touch selection; Reduced/30 FPS controls; persisted settings after reload; world mounting with terrain textures blocked. Screenshots are under `authoring/generated/captures/code-review-*.png`.
- **Passed:** existing `npm run authoring:world:smoke-runtime -- --woodland-bridge` browser test, covering the closed gate, unlocked crossing, and return journey A01 → A02 → A01; screenshots inspected.
- Release payload: **149.91 MiB**. Build still reports the existing large JavaScript chunk and public-icon resolution warnings.
- Desktop browser emulation verifies behavior and layout; actual iPhone performance and the 20-second representative load target remain unverified.

## 3. High-impact performance improvements

Only clear, substantial findings are listed; optimization work below awaits your approval.

1. **Reduce the rare-enemy model before further performance tuning.** `enemy-rare.glb` contains **1,986,130 triangles** and weighs **59.21 MiB**, roughly 39.5% of the whole release payload. Each visible Rare uses this model. Produce a substantially lower-poly runtime asset with baked detail and suitable LODs, then compress its geometry/textures. Download compression alone will not remove the rendering cost. Evidence comes from the GLB accessors and file size. [enemy-rare.glb](public/assets/models/enemies/enemy-rare.glb), [EnemyView.ts](src/rendering/EnemyView.ts)

2. **Simplify water rendering for mobile.** Shared water uses physical transmission (`0.16`), double-sided rendering, and transparency. When visible, transmission triggers an additional opaque-scene render into a multisampled target in the installed Three.js renderer, on top of the normal scene pass. Prefer a cheaper water material for Reduced mode, or for all mobile rendering if the visual difference is acceptable. This is an identifiable extra render pass; its device-specific frame-time cost has not been measured. [WorldMaterials.ts](src/rendering/environment/WorldMaterials.ts)
