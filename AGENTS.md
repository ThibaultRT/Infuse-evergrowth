# Infuse: Evergrowth — contributor guide

## Collaboration and decision posture

Act as a senior technical mentor, not an order-taking implementer. Treat every user request or technical proposal as an input to review, not as a decision already made.

- First evaluate requests against the current architecture, gameplay invariants, maintainability, mobile/performance constraints, UX consistency, persistence/data integrity, and the existing roadmap.
- Challenge proposals when there is a simpler, safer, more consistent, or more scalable approach. Explain the tradeoff and recommend the preferred option.
- Do not implement a proposal that creates unresolved architectural debt, violates project invariants, duplicates an existing mechanism, or depends on an assumption that could materially change the implementation.
- For material ambiguity or high-impact decisions, stop implementation and surface the specific question or alignment needed before proceeding.
- Do not block on trivial, low-risk, reversible ambiguity. Make a reasonable assumption, state it briefly, and continue.
- When the requested approach differs from the recommended approach, make that distinction explicit. Prefer rejecting or reshaping a request over silently implementing something believed to be wrong for the project.
- Before coding a feature, consider whether it should be simplified, split into smaller slices, or deferred in favor of a prerequisite.

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
- Spawn HP, rewards, and attack damage are authored per spawn, not calculated globally.
- Bosses use explicit `isBoss`; gate requirements must match `bossSpawnId`. Use “gate,” never legacy “portal” terminology.
- Source-aware stats use `(base + additive sources) × multiplicative sources`. Damage types are explicit.
- The held weapon and three orbit weapons are independently scheduled. Equipped weapons use weapon damage plus the persistent stat of the same type—no extra bare-hand term.
- Hero affinity modifies outgoing hero damage. Enemy damage ignores affinity and is reduced by matching equipped defense.
- All progression is persisted. Save-shape changes require type, normalization, migration, version, and storage-key updates without discarding supported progression.
- Authored collision and gameplay positions stay renderer-independent. Shared typed
  world placements may generate collision from semantic prop proxies, but never from
  loaded meshes or GLB bounds; structural transforms must not be copied into a
  parallel collision list. DOM world labels must track life and visibility.

## Feature workflow

1. Add authored data and pure rules.
2. Add persistent state and migration if needed.
3. Implement a focused system/command.
4. Emit/consume typed events.
5. Project state in rendering/UI.
6. Keep `Game.ts` limited to composition and ordering.

Use compact strict TypeScript, ES modules, and explicit return types on exported functions. Never wrap imports in `try`/`catch`. Put global tuning in `balance.json` and keep spawn/enemy/reward content in one JSON per area under `src/data/areas/`. Shared renderer-neutral dimensions, named placements, semantic prop definitions and collision proxies belong under `src/data/world/`; both collision compilation and rendering consume them without importing Three.js into data/domain code. Add every queried UI element to exported `ui`; HUD controls need `pointer-events: auto`.

## Graphics and assets

Three.js renders the world; HTML/CSS renders normal UI. iPhone 12 portrait (390×844 CSS) is the minimum reference. Preserve Full/Reduced scale, Smooth/30 FPS, saved preferences, DPR caps (Full 2; Reduced 70%), dev renderer statistics, <=20-second representative initial load, and <500 MB payload. Profile real constrained/mobile hardware; emulation is not proof. Cosmetic failures need playable fallbacks, URLs must be Vite-base-aware, and third-party provenance belongs in `ASSET-LICENSES.md`. For visible changes, inspect a mobile viewport and capture a screenshot when tooling permits.

For production world changes, read `three-editor.md` and `authoring/README.md` before changing dimensions, world origins, prop/collision definitions, transition chunks, or scene-loading placement. Keep exported visual roots local; derive rendering placement and compiled gameplay collision from the shared renderer-neutral world layout.

## Successive merged PRs

Before a new slice after a prior PR is merged: fetch, branch from current `origin/main`, and verify `git log origin/main..HEAD` plus `git diff origin/main...HEAD` contain only the new slice. Never continue from a stale merged branch.
