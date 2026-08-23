# Infuse: Evergrowth — Remaining Implementation Cleanup

## Status

The original architecture migration is **mostly complete, but not finished**.

Already established and no longer part of this cleanup plan:

- `src/main.ts` is a small bootstrap rather than the game implementation;
- Three.js remains the world renderer and HTML/CSS remains the application UI;
- authored balance, areas, equipment, and loot tables are data-driven JSON;
- `GameEvents` provides typed cross-system events;
- `domain/` contains pure combat/item/ability/spawner rules;
- equipment and equipment-drop orchestration live in dedicated systems;
- rendering has dedicated asset/environment/hero/enemy/gate/effect boundaries;
- input/camera responsibilities have dedicated controllers;
- bosses and gates are authored explicitly rather than inferred from rarity;
- physical gates replaced the old teleport/portal product concept;
- versioned persistence, stable spawn IDs, inventory/equipment state, and area progression are established.

The durable architecture rules now live in `AGENTS.md`. Do not recreate the historical migration phases from the old version of this document.

## Why this file still exists

`src/game/Game.ts` is still roughly 39 KB and remains the main concentration of legacy responsibilities. `AGENTS.md` therefore correctly treats it as a coordinator that still needs incremental extraction rather than a finished architecture boundary.

The cleanup is complete only when `Game.ts` mainly owns composition, lifecycle, update ordering, and high-level commands while feature rules live in domain/system modules.

## Remaining work

### 1. Extract combat orchestration

Create/evolve a dedicated combat system responsible for runtime attack orchestration:

- per-source cooldown scheduling;
- target selection/range checks;
- hero and enemy damage application;
- affinity application for hero attacks;
- matching armor reduction for enemy attacks;
- defeat event emission.

Pure formulas remain in `domain/`; the system coordinates runtime state and events. Rendering effects must continue to react to combat results rather than calculate them.

### 2. Extract enemy AI

Move hostile-enemy runtime behavior out of `Game.ts`:

- aggro detection;
- chase/return-to-spawn behavior;
- leash handling;
- attack intent/cooldown handoff to combat;
- non-hostile crystal behavior.

Authored distances and tuning remain in `src/data/balance.json` / area data.

### 3. Extract respawn/spawner orchestration

`SpawnerModel` already provides the domain foundation. Finish the runtime boundary around it so one respawn system owns:

- death lifecycle;
- per-spawn escalating timers;
- local-midnight reset;
- group respawn countdown state;
- per-life stat/equipment loot rerolls;
- save updates for persistent spawn state.

Stable authored spawn IDs remain the source of identity; rendered enemies remain transient occupants.

### 4. Isolate world-attached UI

Move world-to-screen DOM projection and entity-attached labels out of the game coordinator into a dedicated rendering/UI manager.

It should own presentation of:

- target HP/reward labels;
- combat text anchors;
- respawn/group indicators;
- visibility/clipping against current area/life state.

Gameplay modules should provide state/events/positions only.

### 5. Reduce area/gate flow in `Game.ts`

Area and gate data are already authored and physical traversal is implemented. The remaining cleanup is structural:

- centralize active-area lifecycle and entry handling;
- keep gate unlock/progression commands separate from `GateView`;
- keep destination relationships data-driven for future branching connections;
- avoid reintroducing the obsolete `portal` terminology in new APIs/docs/data.

### 6. Continue domain-specific type extraction when touching code

`src/types.ts` still acts as a compatibility/shared type hub. Do not perform a risky type-only rewrite, but when a feature is refactored, move its strongly domain-specific types beside that domain where practical.

## Completion criteria

This document can be deleted when all of the following are true:

- `Game.ts` is primarily composition/lifecycle/update ordering rather than the implementation location for combat, AI, respawn, and world UI;
- combat, enemy AI, and respawn each have clear runtime system boundaries;
- world-attached DOM projection has a dedicated owner;
- area/gate progression is coordinated without rendering or `Game.ts` owning feature rules;
- `npm run build` passes after the extraction;
- `AGENTS.md` accurately describes the resulting source map and dependency rules.

Do the work incrementally. Preserve gameplay and saves during each extraction; architecture cleanup is not a reason for a feature rewrite.
