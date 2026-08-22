# Infuse: Evergrowth — Agent Context

## Project overview

- This repository is an iOS-friendly, browser-based active incremental RPG/PWA built with TypeScript, Three.js, and Vite.
- The current vertical slice has two authored areas and automatic proximity combat. See `README.md` for player-facing behavior and `implementation.md` for detailed game rules.
- The architecture deliberately borrows proven concepts observed in Devour Idle RPG: domain models, systems, events, first-class spawners, separate item definitions/owned state, declarative abilities, and versioned persistence. Do not copy Unity-specific implementation details or introduce Unity/Morpeh merely to imitate Devour.
- There is no test runner configured. The required baseline check is `npm run build`, which runs `tsc --noEmit` and then the Vite production build.

## Common commands

```bash
npm install       # install dependencies
npm run dev       # start Vite's development server
npm run build     # type-check and create dist/
npm run preview   # serve the production build
```

The Vite production base is `/Infuse-evergrowth/` for GitHub Pages. Deployment is defined in `.github/workflows/deploy-pages.yml`.

## Architectural direction

Infuse uses a lightweight entity/domain/system architecture rather than a full ECS framework.

```text
Game bootstrap / coordinator
├── domain/                 pure game concepts and rules
│   ├── items/              static definitions + owned-item progression
│   ├── abilities/          declarative triggers/conditions/effects
│   └── spawning/           stable spawner identity + lifecycle rules
├── systems/                runtime orchestration over domain/save state
│   ├── combat
│   ├── enemy AI
│   ├── equipment
│   ├── drops
│   ├── respawn
│   └── progression
├── game/                   loop/coordinator + typed game events
├── rendering               Three.js views/models/materials
├── application UI          HTML/CSS HUD, inventory, dialogs
└── persistence/data        versioned save + authored JSON configuration
```

The key rule is **model/domain state first, systems operate on it, views render it**. Rendering objects and DOM elements must not become the source of truth for gameplay.

### Devour-derived patterns to preserve

- Separate **static definition/config** from **owned/runtime state**. Example: `EquipmentDefinition` describes a weapon; `OwnedEquipment` stores level/ascend/player ownership.
- Treat spawners as first-class persistent identities. Enemy views are transient occupants of a spawner; respawn timers and rolled loot belong to the stable spawn ID.
- Prefer small systems that perform one gameplay responsibility instead of adding branches to `Game.ts` or entity/view classes.
- Route meaningful cross-system consequences through `GameEvents` instead of direct system-to-system/UI coupling.
- Keep abilities/effects declarative: trigger -> condition -> effect(s). Future poison, stun, crit, lifesteal, AoE, chain attacks, elemental effects, etc. belong in the ability/effect layer rather than item-specific branches in combat code.
- Persist progression as domain state and reconstruct views/world state from it. Do not persist transient Three.js/DOM state.
- Keep authored content data-driven so later areas can expose new equipment/loot without changing core systems.
- Do not introduce a generic ECS library until entity counts/behavior complexity justify it; the current lightweight architecture is intentional.

## Source map

- `src/main.ts`: application entry point; loads global CSS, applies the package version, and starts the game.
- `src/game/Game.ts`: top-level runtime/coordinator. It still contains legacy responsibilities that should be extracted incrementally; do not add new large gameplay subsystems here.
- `src/game/GameEvents.ts`: typed event bus for gameplay events and cross-system reactions.
- `src/domain/items/EquipmentCatalog.ts`: authored equipment definitions/catalog lookup.
- `src/domain/items/EquipmentProgression.ts`: pure equipment level/ascend/damage calculations.
- `src/domain/abilities/Ability.ts`: declarative ability trigger/condition/effect domain types for future special effects.
- `src/domain/spawning/SpawnerModel.ts`: first-class spawner state/lifecycle rules; stable spawn IDs own persistent respawn state.
- `src/systems/EquipmentSystem.ts`: coordinates equipment domain rules with persistent inventory/equipment slots.
- `src/systems/EquipmentDropSystem.ts`: area/tier equipment drop resolution.
- `src/ui.ts`: HUD/modal HTML, cached DOM references, toasts, stat rendering, and inventory rendering.
- `src/style.css` and `src/reward-popups.css`: application and reward-popup presentation.
- `src/data/balance.json`: source of tunable gameplay numbers. Prefer changing balance here instead of hard-coding numbers.
- `src/data/equipment.json`: static authored equipment definitions.
- `src/data/equipment-loot-tables.json`: area-specific equipment pools/unlocks.
- `src/data/areas.json`: authored area origins, fixed spawn points/groups, bosses, and portals.
- `src/config.ts`: converts JSON data into typed runtime configuration and provides calculated enemy stats.
- `src/save.ts`: local-storage schema/loading, daily spawn state, permanent stats, loot rolls, and persistence.
- `src/types.ts`: shared compatibility/gameplay/save types. Prefer new domain-specific types in their domain module when practical.
- `src/controllers/`: camera and input handling.
- `src/visuals.ts` and `src/icons.ts`: Three.js models/materials and inline UI icon markup.
- `src/version.ts`: reads the app version injected from `package.json`; `package.json` is the version source of truth.

## Dependency rules

To keep domain logic testable and portable:

1. `domain/` may depend on authored data and shared TypeScript types, but **must not depend on Three.js, DOM/UI, controllers, or `Game.ts`**.
2. `systems/` may depend on domain modules and persistence/runtime state, but should not own Three.js meshes or DOM elements.
3. Rendering/view code may read domain/runtime state and react to events, but must not define gameplay rules.
4. UI may invoke explicit commands/actions and render state; it must not calculate combat, loot, progression, respawn, or unlock rules.
5. `Game.ts` coordinates lifecycle/update order. New feature-specific logic should normally be implemented in a domain module/system and called from the coordinator.
6. Static authored definitions belong in JSON or definition catalogs; per-player mutable state belongs in the save model.

## Gameplay/data conventions

- Distances in balance data are meters. Cooldowns in balance data are seconds; runtime respawn deadlines are milliseconds since epoch.
- Enemy HP and attack are derived from the Common baseline, area scaling, and tier multiplier in `src/config.ts`.
- Damage types are explicit (`DamageType`). Do not introduce an untracked generic weapon-damage type.
- Both hero hand slots are independent attack sources. Bare-hand and equipped-weapon attacks must remain independently schedulable.
- Spawns have stable authored IDs. Respawn state is stored per spawn with `killsToday`, `defeatedAt`, `respawnAt`, and rolled loot.
- Daily spawn state resets at local midnight. Permanent player stats, boss progression, inventory, and unlocked areas persist.
- Equipment loot tables are area-specific and may inherit/extend prior-area pools so early areas cannot drop end-game equipment.
- Equipment progression terminology is `level` and `ascend`; do not reintroduce `upgrade` for the ascend mechanic.
- When changing the save shape, update the types, normalization/loading logic, save version, and storage key together. Existing malformed/old saves should fall back safely.
- All player progression must be persisted. Whenever a save-shape change is necessary, add an explicit migration helper so existing progression is preserved.
- UI is rendered as a template in `src/ui.ts`; add every interactively queried element to the exported `ui` object. HUD controls need `pointer-events: auto` because the HUD container itself ignores pointer events.
- World-attached labels are DOM elements projected from Three.js positions. Keep their visibility synchronized with entity life and the active area.

## Feature implementation workflow

When adding a gameplay feature, prefer this order:

1. Define/extend authored data and pure domain types/rules.
2. Define persistent state/migration if player progression is involved.
3. Implement the runtime system/command that operates on that state.
4. Emit or consume typed gameplay events for cross-system consequences.
5. Add/update Three.js views and UI as projections of the resulting state.
6. Keep `Game.ts` changes limited to composition, update ordering, and lifecycle wiring.

This order is intentional: do not start a gameplay feature by editing the renderer/UI and then back-fill game state afterward.

## Code style and workflow

- Use strict TypeScript and ES modules. Follow the existing compact style and explicit return types on exported functions.
- Never wrap imports in `try`/`catch`.
- Keep tunable numbers in `src/data/balance.json` and authored map layout in `src/data/areas.json`.
- Do not edit generated `dist/` output or dependency contents.
- Run `npm run build` after code changes. For visible web-app changes, also inspect the running app at a mobile-sized viewport and capture a screenshot when tooling permits.
- Before committing, review `git diff` and `git status`. Commit changes on the current branch.
- Systematically increment the package version before creating a pull request. Use `package.json` as the single source of truth and apply semantic versioning appropriate to the change.

## Consecutive pull requests from one agent session

When a task is delivered as several successive pull requests from the same Codex/agent session, **never start the next slice from the previous slice's stale checkout after that PR has been merged**.

Before starting each new slice after a previous PR was merged:

1. Fetch the latest remote state.
2. Reset/switch the working base to the latest `origin/main` so it includes the just-merged PR.
3. Create a fresh branch for the new slice from that updated `origin/main`; do not keep building on the already-merged slice branch.
4. Implement only the new slice.
5. Before opening the PR, verify `git log origin/main..HEAD` and `git diff origin/main...HEAD` (or equivalent) show only the new slice and do not reintroduce files/commits already merged into `main`.
6. If the new PR unexpectedly contains changes from an earlier merged slice, stop and rebase/recreate the branch from current `origin/main` before opening or updating the PR.

This rule applies even when the user continues in the same Codex Cloud conversation or task window: conversational continuity does not guarantee that the underlying checkout automatically refreshed after a GitHub merge.
