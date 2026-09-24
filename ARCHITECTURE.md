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
- `src/systems/ProgressionSnapshot.ts`: detached, deeply read-only presentation values for Stats, equipped slots, inventory/details/Ascend, Soul layers, and the minion roster. `GameSession.progressionSnapshot()` reads existing rules without mutating the save. Panels consume this interface instead of saves or rule callbacks.
- `src/ui/GameUiController.ts`: panel, inventory, Soul Catcher, minion, and settings interactions; no simulation pause state.
- `src/game/GameEvents.ts`: typed event bus.
- `src/domain/`: combat, stats, items, spawns, and world values.
- `src/domain/world/WorldCollisionCompiler.ts`: pure expansion of shared
  placements/proxies into gameplay collision values.
- `src/systems/`: combat, enemy AI, equipment/drop, Soul Catcher, hero stat projections, respawn, and progression. Boss-gate unlocking has one path in `ProgressionSystem`.
- `src/systems/MinionSystem.ts` and `MinionAISystem.ts`: persistent roster/rewards and transient autonomous intent, respectively. `src/domain/minions.ts` owns pure summon, equipment, recovery, and infusion rules.
- `src/domain/world/WorldNavigation.ts`: routes over authored walk surfaces, semantic collision, and unlocked connections for actors in separate areas.
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
- Progression views refresh on panel open or coalesced progression events. The snapshot is not rebuilt in the simulation/render loop; closed panels do not rebuild their DOM. UI selection, scrolling, and tree transforms stay in the UI controller. Commands still validate against current authoritative state.

## Minion invariants

- `minions.unlockedEver` is the permanent feature flag and records the first free grant. `SC-M01` has a typed `unlockMinions` effect; repeat purchases after Soul Catcher reset grant XP only. Reset preserves the unlock, roster, and paid-summon count. Layer membership comes from the authored layer registry: Layer 1 has 31 nodes including `SC-M01`; Layers 2 and 3 each have 30. The published Layer 1 to 2 threshold remains 84,292 XP. Layer 3 uses seeded, authored effects with exponential purchase costs; `SC-65` unlocks Epic Soul drops from Epic enemies.
- The save owns stable minion IDs, color variants, area/position, HP, respawn deadlines, independent stats/inventory, `copiesEarned` by item ID, and Soul contributions. Target, path, cooldown, and recovery mode are transient. Invalid saved positions fall back to the shared Summoning Pit placement in `src/data/world/minionPit.ts`; expired death deadlines revive at the pit.
- `GameplayRuntime` and `MinionAISystem` simulate minions and engaged enemies in areas containing the hero or a living minion, regardless of visual residency. Navigation uses authored walk surfaces, semantic blockers, and unlocked connections. Hero area/camera state does not follow a minion. The hero-centered visual streamer only mounts nearby views; remote combat has no local combat overlays or cinematics.
- A lethal hit has one stable `CombatActorRef` owner. `ProgressionSystem.defeat` commits the spawn's global defeat/respawn state, Soul credit, boss/gate consequences, and that owner's stat/equipment rewards once before emitting presentation events. Minion drops stay in private inventory; their `copiesEarned` ledger counts awarded quantities before Ascend consumes copies. Soul contribution totals are attribution only; Souls enter the player's balance on the kill.
- `MinionSystem` auto-equips compatible drops, prefers a free slot, and replaces equipped gear only for a strict improvement in standalone calculated value. Sacrifice consumes the roster once, adds half of its kill-earned stats to the hero's `minions` additive sources, and transfers every lifetime earned equipment copy through the usual copy rule. It does not transfer Ascend ranks or credit Souls again. Paid summoning uses the persisted count and `balance.json` cost/capacity values.
- Minion combat advances only during active simulation. Wall-clock respawn deadlines may mature while the app is away, but elapsed background time grants no combat rewards. `MinionIdleController` pauses minion activity after five minutes without input using a device-local setting; it does not delete or reset progression.

## Offline assets and updates

`src/sw.ts` uses a Workbox build revision manifest. Only the application shell and UI icons are precached during installation. Every file in `public/assets/` is listed for lazy caching, including world/Quaternius/KayKit assets, standalone models, GLTF buffers, external textures, and embedded GLBs. New asset folders participate automatically. Models' external dependencies must also be shipped and present in that manifest.

Offline coverage means **previously loaded content**, not an automatic download of the whole world. The worker caches successful asset responses as they are requested. Unvisited content and browser-evicted files require a connection; existing playable visual fallbacks still apply. Cache storage failure cannot block a successful network asset load. The worker does not cache HTML error pages as models or textures.

Asset cache keys and network URLs include each file's content revision. Unchanged files survive app releases, while changed files load under a new key on their next request. Activation removes obsolete revisions and this app's entries in the old mutable caches; unrelated caches/scopes are preserved. Current assets have no arbitrary entry-count or age expiry, so GLTF files do not deliberately outlive their dependencies. Browser storage quotas/eviction still apply. Revisions identify build content, not a cryptographic security guarantee.

`version.json` always stays online-only. Worker registration runs independently of that endpoint; first boot waits up to the existing five-second update budget for control before loading assets. Release validation checks every public asset's revision and every GLTF/GLB external dependency. After `npm run build`, `npm run validate:offline` exercises the built worker with isolated Chromium storage, offline reload, and alternate asset releases. The Workbox build summary counts the entire revision inventory, even though only the shell is precached.

## Review checklist

- Can the rule run without WebGL and the DOM?
- Is mutable truth in domain/runtime/save state rather than a view?
- Does a focused system own the rule?
- Are inputs commands and outputs plain snapshots/events keyed by IDs?
- Are clock, random, and storage boundaries injectable where deterministic tests need them?
- Can presentation be rebuilt from saved/domain state?
