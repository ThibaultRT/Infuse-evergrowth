# Infuse: Evergrowth — Implementation Cleanup

## Objective

Refactor the current codebase into a cleaner, scalable game architecture while preserving current gameplay and deployment.

Keep:

- TypeScript
- Vite
- Three.js
- HTML/CSS for application UI
- PWA support
- GitHub Pages deployment

This is an architecture refactor, not an engine rewrite. The main goal is to stop `src/main.ts` from owning most game responsibilities and establish clear boundaries between game logic, rendering, input, UI, persistence, and authored world data.

## Target architecture

```text
Game bootstrap
├── World / areas
│   ├── Area definitions
│   ├── Spawns
│   ├── Portals
│   └── Environment
├── Entities
│   ├── Hero
│   ├── Enemies
│   └── Bosses
├── Systems
│   ├── Input
│   ├── Combat
│   ├── Enemy AI
│   ├── Respawn
│   ├── Camera
│   ├── Progression
│   └── Events
├── Rendering
│   ├── Three.js scene
│   ├── Entity views
│   ├── Environment views
│   └── World-space UI projection
├── Application UI
│   ├── HUD
│   ├── Stats
│   ├── Inventory
│   └── Mobile controls
└── Persistence / data
    ├── Save data
    ├── Balance data
    ├── Area data
    └── Domain types
```

Game rules should not depend directly on Three.js or DOM elements wherever practical. Three.js renders the world; HTML/CSS continues to render normal application UI.

## Keep Three.js

Retain Three.js as the world renderer. The game already uses a genuine 3D scene with a perspective camera, meshes, lighting, shadows, fog, continuous world coordinates, and continuous character rotation.

Future characters should remain 3D objects with smooth 360-degree facing. Do not introduce a directional sprite system.

When proper character assets are introduced, prefer:

- GLTF/GLB models;
- skeletal rigs;
- animation clips;
- `THREE.AnimationMixer`.

Typical clips: idle, walk/run, attack, hit, death. Character facing remains a continuous yaw angle and can later interpolate smoothly toward movement or attack direction.

## Reduce `main.ts` to bootstrap

`src/main.ts` should eventually do little more than:

```text
load configuration
create game
start game
```

Move scene setup, combat, enemy behavior, input, camera logic, respawn logic, world UI, and area-specific data into dedicated modules.

## Game/bootstrap layer

Create a `Game` or equivalent top-level module responsible for:

- creating the Three.js renderer and scene;
- creating top-level systems;
- resize handling;
- the master update loop;
- lifecycle/startup;
- loading the initial area.

It should coordinate systems, not contain gameplay rules.

## Area system

Area-specific content must no longer be hardcoded into engine code.

Introduce an `AreaManager` and data-driven area definitions, for example:

```text
data/
  areas/
    area-1.json
    area-2.json
```

An `AreaDefinition` should contain at minimum:

- stable area ID;
- display name;
- bounds;
- player entry points;
- enemy/crystal spawn definitions;
- boss IDs;
- portal definitions;
- environment data/assets;
- optional camera parameters.

Move Area 1 authored positions into area data. Area 2 can initially contain only the groundwork needed for future implementation.

## Portals

Make portals first-class world entities rather than special cases.

Example definition:

```json
{
  "id": "area1-to-area2",
  "tags": ["portal", "area-2"],
  "destinationArea": "area-2",
  "destinationSpawnId": "entry-from-area-1",
  "unlockCondition": {
    "type": "bossDefeated",
    "bossId": "legendary-01"
  }
}
```

Requirements:

- portals may start locked;
- several portals from several areas may target the same destination area;
- each portal has a stable ID/tags;
- destination area and destination entry point are explicit;
- unlock state is independent from visual implementation.

## Boss identity

Do not permanently equate `legendary` with `boss`.

Boss identity should be explicit in area/enemy data. Area 1 may designate `legendary-01` as its boss while allowing future legendary non-boss enemies or bosses of other tiers.

Boss defeat should emit a gameplay event.

## Lightweight event system

Introduce a small typed event bus/dispatcher to reduce direct coupling between systems.

Useful events include:

```text
enemyDamaged
enemyDefeated
enemyRespawned
bossDefeated
heroDamaged
heroDefeated
statGained
portalUnlocked
portalEntered
areaEntered
```

Keep this lightweight; do not build a large framework.

## Separate entities from rendering

Split enemy concerns conceptually into:

```text
Enemy
  runtime/domain state

EnemyView
  Three.js representation

EnemyAI
  aggro / chase / leash / attack intent

CombatSystem
  targeting / attacks / damage / defeat

RespawnSystem
  death / timers / respawn

WorldUiManager
  HP / reward / combat text / respawn indicators
```

Do the same for the hero:

```text
Hero
  logical/runtime state

HeroView
  Three.js representation

HeroController
  movement / facing / attack intent
```

Gameplay logic should avoid directly manipulating `THREE.Group` or DOM nodes where practical.

## InputController

Move keyboard and mobile joystick handling out of `main.ts`.

Expose normalized input, e.g.:

```ts
input.movement.x
input.movement.y
```

The hero controller should not care whether input came from touch, keyboard, or a future gamepad.

## CameraController

Create a dedicated camera system supporting:

- normal smooth follow;
- focus on a world target;
- pan;
- optional zoom;
- temporary scripted movement;
- return to hero.

This must support sequences such as:

```text
boss defeated
→ portal unlocks
→ camera pans to portal
→ portal opening animation
→ camera returns to hero
```

Gameplay code requests camera behavior rather than directly changing camera coordinates.

## CombatSystem

Move combat rules out of rendering/entity-view code.

The combat system should own:

- attack range checks;
- cooldowns;
- target selection;
- damage application;
- damage types;
- defeat events.

Keep current automatic attack behavior. Weapon-specific damage/range can later come from equipped-item data.

## Enemy AI

Move enemy behavior into an AI/controller layer responsible for:

- aggro detection;
- chasing;
- leash distance;
- attack intent;
- return-to-spawn behavior.

Crystals remain non-hostile and stationary.

## RespawnSystem

Centralize:

- per-spawn death state;
- respawn timers;
- tier multipliers;
- daily kill escalation;
- midnight reset;
- group respawn state;
- loot reroll on respawn.

The save layer owns persistence; the respawn system updates save state through that layer.

## Save and stat model

Keep the existing source-aware stat model:

```text
(base + additive sources) × multiplicative sources
```

Persistence must remain renderer-independent.

The save layer should own:

- local save load/store;
- save schema;
- stat serialization;
- inventory serialization;
- spawn persistence;
- local-date helpers.

## Human-readable balance data

Move editable base values and authored content into JSON.

Suggested structure:

```text
data/
  game-balance.json
  tiers.json
  enemies.json
  areas/
    area-1.json
    area-2.json
```

Centralize values such as:

Hero:
- base HP;
- base attack;
- regeneration;
- speed;
- bare-hand range;
- attack cooldown.

Enemy/tier:
- HP/stat multipliers;
- attack multipliers;
- stat rewards;
- respawn multipliers;
- hostile flag;
- movement speed;
- attack range;
- aggro radius;
- leash.

Keep behavioral formulas in TypeScript and editable coefficients/base values in JSON. Avoid duplicate sources of truth.

## UI

Keep HTML/CSS for normal UI:

- HP HUD;
- stats;
- inventory;
- equipment dock;
- joystick;
- toasts;
- modal panels.

Do not move standard UI into Three.js.

For world-attached UI such as target HP bars, loot labels, respawn indicators, and floating damage text, keep DOM projection initially but isolate it in a `WorldUiManager`.

## WorldUiManager

Own:

- world-to-screen projection;
- target HP/reward labels;
- combat text;
- group respawn indicators;
- visibility/clipping.

Combat/entity code should provide only the state and position required for display.

## Suggested folder direction

Exact names may vary; responsibility boundaries matter more than creating many tiny files.

```text
src/
  main.ts

  game/
    Game.ts
    GameEvents.ts

  world/
    Area.ts
    AreaManager.ts
    Portal.ts

  entities/
    Hero.ts
    Enemy.ts

  controllers/
    HeroController.ts
    EnemyAI.ts
    InputController.ts
    CameraController.ts

  systems/
    CombatSystem.ts
    RespawnSystem.ts
    ProgressionSystem.ts

  rendering/
    HeroView.ts
    EnemyView.ts
    EnvironmentView.ts
    WorldUiManager.ts

  persistence/
    save.ts

  ui/
    ui.ts
    inventory.ts
    stats.ts

  data/
    loader.ts

  types/
    game.ts
    world.ts
    combat.ts
    save.ts

data/
  game-balance.json
  tiers.json
  enemies.json
  areas/
    area-1.json
    area-2.json
```

## Migration order

Refactor incrementally and preserve behavior.

### Phase 1 — Data foundation

- create JSON balance data;
- introduce `AreaDefinition`;
- move Area 1 spawn positions to area data;
- add explicit boss identity;
- add portal definitions;
- add Area 2 groundwork.

### Phase 2 — Infrastructure

Extract:

- `Game`;
- `InputController`;
- `CameraController`;
- `WorldUiManager`;
- event system.

### Phase 3 — Gameplay systems

Extract:

- `CombatSystem`;
- `EnemyAI`;
- `RespawnSystem`;
- hero controller;
- enemy logical state.

### Phase 4 — Area transitions

Implement:

- `AreaManager`;
- portal lock/unlock;
- boss defeat event;
- portal camera sequence;
- area unload/load;
- destination spawn handling.

### Phase 5 — Proper graphical assets

After the architecture is stable:

- load GLTF/GLB environments;
- add rigged hero/enemy models;
- add animation clips;
- use `AnimationMixer`;
- add smooth facing interpolation.

Do not block architecture cleanup on final art.

## Constraints

Preserve throughout the refactor:

1. Safari/iPhone compatibility.
2. GitHub Pages deployment.
3. PWA/offline behavior.
4. Current gameplay unless explicitly changed.
5. Three.js as the world renderer.
6. Continuous 360-degree character facing.
7. HTML/CSS for standard UI.
8. Renderer-independent game rules where practical.
9. Human-readable balance and area data.
10. Stable IDs for enemies, spawns, bosses, portals, and areas.
11. Multiple portals may lead to the same destination area.
12. Do not put new major systems back into `main.ts`.
13. Avoid unnecessary framework additions.
14. Preserve Vite's `/Infuse-evergrowth/` GitHub Pages base path.
15. Avoid root-relative asset URLs that break GitHub Pages.

## Expected end state

The refactor should preserve player-visible behavior while making additions data- and system-driven.

Adding a new area should primarily require:

```text
area data
environment assets
spawn definitions
portal definitions
boss/progression definitions
```

Adding a new enemy should primarily require:

```text
enemy data
visual asset
AI profile
```

Adding a new weapon should primarily require:

```text
item data
damage/range data
visual asset
```

The project should remain intentionally small and browser-native while giving the Three.js game a clean, scalable structure.