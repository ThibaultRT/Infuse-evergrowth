# Architecture

Infuse uses a lightweight domain/system/runtime architecture. It is intentionally not a generic ECS.

```text
src/data + src/domain   authored definitions and pure rules
          ↓
src/save + src/systems persistent state and focused operations
          ↓
src/game                authoritative live runtime, events, composition/update order
          ↓
src/rendering + src/ui  Three.js/DOM projections and input adapters
```

## Dependency rules

1. Domain code is deterministic and engine-neutral.
2. Systems operate on plain domain/runtime/save values and stable IDs; they do not own views.
3. `GameplayRuntime` owns live positions, HP/life state, movement, enemy intent, death timing, and area transitions.
4. `GameEvents` carries meaningful results across systems and presentation.
5. `GameSession` coordinates combat, progression, respawns, daily resets, regeneration, and persistence using injected save, events, clock, random, and write callbacks. `Game.ts` composes the browser, orders session/render updates, and projects events into views.
6. Rendering and UI may read snapshots and react to events but never define combat, progression, loot, spawn, respawn, or unlock rules.
7. Persistence stores progression and stable gameplay state, never meshes, DOM, cameras, mixers, or other transient presentation objects.
8. Renderer-neutral world layouts may be a shared authored input to both rendering
   and collision compilation. Collision comes from intentional semantic prop proxies
   and explicit gameplay volumes, never from loaded meshes, GLB bounds or visual
   residency.

## Key modules

- `src/game/GameplayRuntime.ts`: renderer-independent live-world simulation.
- `src/game/Game.ts`: browser composition root, visual event bindings, and render loop.
- `src/game/GameSession.ts`: renderer-independent gameplay lifecycle and system coordination.
- `src/game/GameCommands.ts`: explicit commands acting on the injected session state.
- `src/ui/GameUiController.ts`: panel, inventory, Soul Catcher, and settings interactions; no simulation pause state.
- `src/game/GameEvents.ts`: typed event bus.
- `src/domain/`: combat, stats, items, spawns, and world values.
- `src/domain/world/WorldCollisionCompiler.ts`: pure expansion of shared
  placements/proxies into gameplay collision values.
- `src/systems/`: combat, enemy AI, equipment/drop, Soul Catcher, hero stat projections, respawn, and progression. Boss-gate unlocking has one path in `ProgressionSystem`.
- `src/rendering/`: asset-backed Three.js views and effects.
- `src/save.ts`: versioned loading/migration and one recoverable previous save. The current save wins when valid; the backup is used on corruption. Simultaneous tabs deliberately use last-write-wins.
- `src/data/areas/*.json`: language-neutral spawn, enemy, reward and encounter
  content.
- `src/data/world/`: typed renderer-neutral dimensions, layouts, semantic
  prop definitions and intentional collision proxies.

## Portability

Pure domain, systems, data, and `GameSession` can run without a browser renderer. Presentation consumes plain results through `GameEvents`; save writes, time, and randomness can be substituted for deterministic checks. A Unity move would still require a C# port or a deliberate cross-language boundary—renderer separation does not make TypeScript directly executable in Unity.

## Runtime policies

- Additive attack sources include the attacking weapon; every multiplier applies to their sum. Hand and orbit attacks stay independent, with one Stats breakdown per equipped slot. Armor joins matching flat defense before multipliers.
- Ascend consumes `threshold - 1` copies, retaining the item and all excess copies.
- Gameplay continues during panels, DOM confirmations, and camera presentations. Only rendering is unavailable during WebGL context loss; browser background throttling remains platform-controlled.
- Reduced resolution disables water transmission and uses front faces. Full retains authored transmission and double-sided water.

## Review checklist

- Can the rule run without WebGL and the DOM?
- Is mutable truth in domain/runtime/save state rather than a view?
- Does a focused system own the rule?
- Are inputs commands and outputs plain snapshots/events keyed by IDs?
- Are clock, random, and storage boundaries injectable where deterministic tests need them?
- Can presentation be rebuilt from saved/domain state?
