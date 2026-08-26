# Infuse: Evergrowth — contributor guide

## Project and checks

Infuse is an iOS-friendly browser incremental RPG/PWA built with strict TypeScript, Three.js, and Vite. The authored world currently has three continuously connected areas, proximity combat, persistent progression, and data-driven spawns/equipment.

```bash
npm install
npm run dev
npm run build          # required after code changes: tsc --noEmit + Vite build
npm run preview
npm run validate:release
```

There is no test runner yet. Do not edit `dist/` or dependencies. Before committing, review `git diff` and `git status`, increment `package.json` with appropriate semantic versioning, and commit on the current branch. The Vite production base is `/Infuse-evergrowth/`.

## Architecture

Use the existing lightweight layers; do not add a generic ECS without measured need.

- `src/domain/`: pure rules and engine-neutral values. No Three.js, DOM, UI, controllers, or `Game.ts`.
- `src/systems/`: focused orchestration over domain, runtime, and save state. No meshes or DOM.
- `src/game/`: authoritative runtime, typed events, composition, lifecycle, and update order.
- `src/rendering/` and `src/controllers/`: Three.js views, effects, assets, camera, and input.
- `src/ui.ts` and CSS: HTML projection and explicit user commands; never gameplay calculations.
- `src/data/`: authored content and global balance. `src/save.ts`: versioned persistent state/migrations.

Model state is authoritative; systems change it; views project it. Cross-system consequences use `GameEvents`. New boundaries use plain values and stable IDs, never Three.js/DOM/animation objects. See `ARCHITECTURE.md` for the stable dependency map and `roadmap.md` for planned improvements.

## Gameplay invariants

- Static equipment definitions are separate from owned Level/Ascend state. Ascend scales both the new base and per-level growth as configured.
- Spawners have stable authored IDs. Their save state owns daily kills, defeat/respawn deadlines, and the persisted per-life HP/reward roll. Reroll only on revival, explicit reset, or local-midnight reset.
- Spawn HP/rewards are authored per spawn, not calculated globally. Enemy attack alone uses the configured area/tier formula.
- Bosses use explicit `isBoss`; gate requirements must match `bossSpawnId`. Use “gate,” never legacy “portal” terminology.
- Source-aware stats use `(base + additive sources) × multiplicative sources`. Damage types are explicit.
- Both hands are independently scheduled. Empty hands use persistent Blunt attack. Equipped weapons use weapon damage plus the persistent stat of the same type—no extra bare-hand term.
- Hero affinity modifies outgoing hero damage. Enemy damage ignores affinity and is reduced by matching equipped defense.
- All progression is persisted. Save-shape changes require type, normalization, migration, version, and storage-key updates without discarding supported progression.
- Authored collision and gameplay positions stay renderer-independent. DOM world labels must track life and visibility.

## Feature workflow

1. Add authored data and pure rules.
2. Add persistent state and migration if needed.
3. Implement a focused system/command.
4. Emit/consume typed events.
5. Project state in rendering/UI.
6. Keep `Game.ts` limited to composition and ordering.

Use compact strict TypeScript, ES modules, and explicit return types on exported functions. Never wrap imports in `try`/`catch`. Put global tuning in `balance.json` and world/spawn content in `areas.json`. Add every queried UI element to exported `ui`; HUD controls need `pointer-events: auto`.

## Graphics and assets

Three.js renders the world; HTML/CSS renders normal UI. iPhone 12 portrait (390×844 CSS) is the minimum reference. Preserve Full/Reduced scale, Smooth/30 FPS, saved preferences, DPR caps (Full 2; Reduced 70%), dev renderer statistics, <=20-second representative initial load, and <500 MB payload. Profile real constrained/mobile hardware; emulation is not proof. Cosmetic failures need playable fallbacks, URLs must be Vite-base-aware, and third-party provenance belongs in `ASSET-LICENSES.md`. For visible changes, inspect a mobile viewport and capture a screenshot when tooling permits.

## Successive merged PRs

Before a new slice after a prior PR is merged: fetch, branch from current `origin/main`, and verify `git log origin/main..HEAD` plus `git diff origin/main...HEAD` contain only the new slice. Never continue from a stale merged branch.
