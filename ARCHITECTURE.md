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
5. `Game.ts` composes services, orders updates, accepts UI commands, and synchronizes views. New feature rules do not belong there.
6. Rendering and UI may read snapshots and react to events but never define combat, progression, loot, spawn, respawn, or unlock rules.
7. Persistence stores progression and stable gameplay state, never meshes, DOM, cameras, mixers, or other transient presentation objects.
8. Renderer-neutral world layouts may be a shared authored input to both rendering
   and collision compilation. Collision comes from intentional semantic prop proxies
   and explicit gameplay volumes, never from loaded meshes, GLB bounds or visual
   residency.

## Key modules

- `src/game/GameplayRuntime.ts`: renderer-independent live-world simulation.
- `src/game/Game.ts`: browser composition root and loop.
- `src/game/GameEvents.ts`: typed event bus.
- `src/domain/`: combat, stats, items, spawns, and world values.
- `src/domain/world/WorldCollisionCompiler.ts`: pure expansion of shared
  placements/proxies into gameplay collision values.
- `src/systems/`: combat, enemy AI, equipment/drop, respawn, and area flow.
- `src/rendering/`: asset-backed Three.js views and effects.
- `src/save.ts`: versioned local-storage loading and migration.
- `src/data/areas/*.json`: language-neutral spawn, enemy, reward and encounter
  content.
- `src/data/world/`: typed renderer-neutral dimensions, layouts, semantic
  prop definitions and intentional collision proxies.

## Portability

Pure domain, systems, data, and most live simulation can survive a browser-renderer replacement. The remaining coupling is consequence/persistence wiring in `Game.ts`; its extraction is tracked in `4-gameplay-architecture.md`. A Unity move would still require a C# port or a deliberate cross-language boundary—renderer separation does not make TypeScript directly executable in Unity.

## Review checklist

- Can the rule run without WebGL and the DOM?
- Is mutable truth in domain/runtime/save state rather than a view?
- Does a focused system own the rule?
- Are inputs commands and outputs plain snapshots/events keyed by IDs?
- Are clock, random, and storage boundaries injectable where deterministic tests need them?
- Can presentation be rebuilt from saved/domain state?
