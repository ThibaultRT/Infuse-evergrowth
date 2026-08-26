# 4 — Gameplay architecture

## Outcome

Make the authoritative gameplay runtime runnable and testable without Three.js or the DOM, while retaining the intentional lightweight domain/system design.

## Plan

1. Introduce explicit commands for movement, equipment, reset, and progression actions.
2. Move reward application, loot resolution, boss/gate progression, and persistence consequences out of `Game.ts` into focused systems/runtime services.
3. Publish plain state snapshots and typed events keyed by stable IDs; presentation resolves IDs to views.
4. Put storage and clock access behind small adapters so migrations, daily reset, and respawn can be tested deterministically.
5. Continue moving stray graphical helpers into `rendering/` or controllers when touched; do not perform a directory-only rewrite.

## Boundaries

`domain/` is pure, `systems/` operates on domain/save/runtime state, `game/` coordinates commands and updates, and `rendering/` plus UI projects results. No gameplay API may expose Three.js, DOM, animation, or controller objects. Do not introduce a generic ECS unless measured entity/behavior complexity justifies it.
