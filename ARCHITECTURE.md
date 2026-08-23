# Architecture and renderer portability

This document describes the architecture that exists today, evaluates how safely the presentation layer can be replaced, and records the intended boundary for future work. `AGENTS.md` remains the contributor rulebook; this file is the human-readable architectural rationale and migration guide.

## Executive assessment

The project has a **good gameplay foundation, but not yet a replaceable renderer boundary**.

- The authored JSON, save model, domain rules, and most classes in `src/systems/` do not depend on Three.js. Combat affinity, equipment progression, spawn rolls, respawn decisions, area-flow decisions, and enemy intent can be reused or ported without deriving their rules from a rendered object.
- `src/rendering/` has a clear presentation responsibility, and `GameEvents` already provides useful semantic notifications such as attacks, defeats, respawns, equipment changes, and area transitions.
- However, `src/game/Game.ts` is currently both the application composition root **and** a browser/Three.js runtime. It owns scene creation, rendered entity classes, positions, movement, live HP, target selection adapters, damage consequences, death/revival flow, DOM interaction, camera behavior, effects, and the animation loop.
- Some presentation helpers still live outside `src/rendering/` (`src/visuals.ts`, `src/controllers/CameraController.ts`, browser UI code), although their purpose is graphical or platform-specific.

Consequently, replacing Three.js with another browser renderer today would leave the pure domain and system modules intact, but it would require substantial work in `Game.ts` and its entity/runtime wiring. Moving to Unity is a larger platform migration: Unity cannot directly consume the TypeScript runtime as ordinary game code. The choices would be to port the renderer-independent rules to C#, retain them behind a JavaScript/service boundary, or share only language-neutral data and behavioral specifications.

The realistic goal is therefore not “change engines without touching any gameplay-related file.” It is:

> Gameplay rules and persisted progression must not change when presentation technology changes; only platform adapters, views, input, audio, and the runtime composition layer should be replaced or ported.

That separation is worth making. It improves testability and iteration now, even if an engine migration never happens. It should be achieved incrementally rather than by introducing a generic ECS or performing a speculative rewrite.

## Current dependency map

```text
Browser entry (`main.ts`)
  -> coordinator/browser runtime (`game/Game.ts`)
       -> domain + systems + save/config
       -> Three.js rendering views and effects
       -> browser UI and world-space DOM labels
       -> input/camera controllers
       -> requestAnimationFrame and browser lifecycle

Authored JSON -> config/catalogs -> domain and systems
Save data <-> persistence helpers <-> coordinator/systems
GameEvents <- gameplay consequences -> UI/rendering reactions
```

### Already portable or close to portable

| Area | Current state | Migration value |
| --- | --- | --- |
| `src/domain/` | Pure rules and types; no Three.js or DOM ownership | High: preserve behavior and port mechanically if the language changes |
| `src/systems/CombatSystem.ts` | Cooldowns, target choice through an abstract distance callback, and damage resolution | High, though target/world state should eventually be owned by the simulation |
| `src/systems/EnemyAISystem.ts` | Returns semantic intents from scalar state/distances | High: the renderer can animate an intent rather than decide it |
| Equipment, drops, respawn, area flow | Operate on domain/save data rather than meshes | High |
| `src/game/GameEvents.ts` | Typed semantic event boundary without rendering payloads | High; suitable for presentation subscribers |
| `src/data/*.json` | Language-neutral authored definitions | High, provided equivalent validation/loading is implemented in the destination runtime |
| `src/save.ts` | Renderer-independent persisted progression | Conceptually portable; storage and TypeScript implementation are platform adapters |

### Current migration blockers

1. **`Game.ts` mixes simulation and presentation.** `SpawnEntity` owns gameplay state such as HP, provocation, cooldown, and life state alongside `THREE.Group`, `EnemyView`, effects, and DOM health labels. `GateEntity` similarly combines gate state, spatial checks, and a `GateView`.
2. **World position is represented by rendered transforms.** Hero/enemy positions and distances use `THREE.Vector3` and `Object3D.position`; movement and arena constraints mutate those transforms directly. A headless simulation cannot currently advance the world without constructing Three.js objects.
3. **The browser loop is the game loop.** Simulation updates, presentation updates, UI refresh, persistence checks, and rendering are scheduled together by `requestAnimationFrame`.
4. **Gameplay consequences are applied inside presentation-aware methods.** Receiving damage, defeat rewards, boss progression, hero death, resurrection, and area entry trigger domain mutations and graphical effects in the same call path.
5. **Input and UI are wired directly to the coordinator.** DOM events call equipment/progression commands, and browser input feeds rendered hero movement without a platform-neutral command boundary.
6. **Events are notifications, not a complete simulation API.** They help decouple reactions, but the authoritative runtime state is still distributed through `Game.ts`, save globals, and rendered entities.

These are boundary problems, not evidence that the gameplay rules themselves need to be rewritten.

## Target architecture

The desired dependency direction is:

```text
Authored definitions + save snapshot
                 |
                 v
        Headless gameplay runtime
  (world state, commands, fixed update, systems)
                 |
          snapshots + events
                 v
       Presentation/platform adapter
  (Three.js or Unity, UI, input, audio, storage)
```

### 1. Headless gameplay runtime

Create a renderer-independent runtime that owns all authoritative mutable gameplay state:

- hero position, HP, death/respawn state, and current area;
- spawn position, current HP/life, aggro state, cooldowns, and respawn state;
- gate lock state and area transitions;
- equipment attack sources and combat scheduling;
- simulation time and command processing.

It should expose a small API resembling:

```text
create(initialSave, authoredDefinitions)
dispatch(command)
update(deltaSeconds)
snapshot()
subscribe(gameplayEvent)
serialize()
```

This is a conceptual contract, not a requirement to introduce these exact names or one large class. Existing small systems should remain small.

Use plain domain coordinates such as `{ x, y, z }` (or a domain `Vector3` value type), not `THREE.Vector3`, Unity vectors, transforms, meshes, DOM elements, or animation objects. The simulation is the source of truth; a view copies or interpolates from snapshots.

### 2. Commands into gameplay

Platform input and UI should translate user intent into commands such as movement input, equip, unequip, ascend, reset cooldowns, and reset permanent stats. Commands must not contain browser events, DOM elements, raycasters, meshes, or Unity objects.

The gameplay runtime validates and applies commands. UI must not calculate whether an action is legal.

### 3. State and events out to presentation

Views receive read-only snapshots for continuous state and semantic events for one-shot presentation:

- snapshots: positions, facing, HP, alive state, current area, gate state, equipment, cooldown display state;
- events: attack started, damage applied, entity defeated/respawned, loot granted, boss defeated, gate unlocked, area entered.

Events should carry stable domain IDs and plain values. They should say what happened, not which animation, particle, sound, mesh, or HTML element to use. A renderer maps the same event to Three.js animation today or a Unity Animator/VFX response later.

Animations, root motion, particles, camera focus, floating text, and asset availability must never determine damage timing, rewards, respawn, unlocks, or persisted state.

### 4. Replaceable adapters

Keep these outside the gameplay runtime:

- rendering and asset loading;
- camera and graphical quality;
- input-device sampling;
- HTML/native UI;
- audio and haptics;
- wall-clock, frame scheduling, storage, and platform lifecycle.

Time and randomness used by gameplay should be injectable behind narrow interfaces where deterministic validation matters. Cosmetic randomness remains presentation-owned.

### 5. Persistence boundary

The save schema remains a domain contract. Browser `localStorage` is only one storage adapter. The runtime should accept normalized save data and return serializable progression rather than reading or writing browser storage itself.

For a Unity migration, preserve stable authored IDs and publish a documented JSON schema/version for content and saves. A C# implementation can then load the same data and migrate the same logical fields even though it will not reuse TypeScript functions directly.

## Incremental separation plan

Do not pause feature development for a broad engine abstraction. Apply these steps when nearby code is already changing:

1. **Introduce platform-neutral position/state models.** Move hero and live spawn state out of `THREE.Object3D` and `SpawnEntity`; make views consume that state.
2. **Extract gameplay consequences from rendered entities.** Move damage application, defeat/reward resolution, hero resurrection, and boss/gate progression into domain systems or focused runtime services.
3. **Split simulation tick from render tick.** Advance gameplay independently, then synchronize views and UI. A fixed simulation step can be considered if determinism or offline advancement requires it; it is not mandatory merely for architectural purity.
4. **Make `Game.ts` a thin composition root.** It should construct the runtime and platform adapters, route commands, subscribe presentation to events, and order lifecycle calls—not contain feature rules or entity models.
5. **Move remaining graphical helpers under presentation ownership.** Fold `src/visuals.ts` and camera-specific controllers into an explicit browser/Three.js adapter structure when touched.
6. **Add boundary tests when a test runner is introduced.** Domain/runtime tests should run in Node without WebGL or DOM. An import-boundary check should reject `three`, DOM, `ui`, and renderer dependencies from domain/simulation modules.
7. **Only then evaluate a second renderer.** A small alternate headless or debug presentation is a cheaper proof of the boundary than beginning a full Unity port.

Prefer extraction with behavior-preserving seams. Do not add mirror interfaces for every Three.js class, create a renderer-agnostic “god interface,” or leak engine types through nominal wrappers; those approaches preserve coupling under new names.

## Engine migration expectations

### Replacing Three.js in the browser

After the target boundary exists, a replacement browser renderer should reuse the TypeScript gameplay runtime, data, events, and persistence contracts. It would replace the rendering, camera, asset, input, and possibly UI adapters. Until the `Game.ts` state extraction is complete, it will also require gameplay-aware integration changes.

### Moving to Unity

Unity is both a renderer and a different runtime/language ecosystem. Even with perfect separation, expect to implement:

- C# equivalents of the headless domain/runtime systems, or a deliberate JavaScript interoperability/service layer;
- Unity views, animation, VFX, camera, input, UI, audio, storage, and lifecycle adapters;
- JSON/schema loaders and save migrations;
- parity tests against representative combat, progression, spawn, and save fixtures.

Good separation prevents graphical choices from changing gameplay semantics; it does not eliminate the cost of porting executable TypeScript to C#.

## Architectural acceptance checks

The presentation boundary is ready for an engine experiment when all of the following are true:

- a complete combat/respawn/area-flow scenario can run without WebGL, DOM, or browser globals;
- no authoritative gameplay state lives only in a mesh, transform, animation, or label;
- gameplay modules do not import Three.js, rendering, UI, controllers, or `Game.ts`;
- renderer-facing snapshots/events contain stable IDs and plain serializable values;
- input/UI reach gameplay through explicit commands;
- saving and loading use a storage-independent schema;
- swapping or disabling a view cannot change damage, cooldowns, rewards, drops, respawns, or unlocks;
- representative fixtures produce equivalent results in any ported runtime.

Until those checks pass, describe the codebase as **renderer-conscious and increasingly separated**, not renderer-independent.
