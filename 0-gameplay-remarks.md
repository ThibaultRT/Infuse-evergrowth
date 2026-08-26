# 0 — Gameplay review remarks

Review scope: gameplay runtime, combat/AI/respawn/area systems, equipment rules, save loading, authored configuration, and their orchestration in `Game.ts`. This is a static review; the repository currently has no automated test runner.

## Findings

1. **High — save normalization trusts authored identifiers and can make a valid-version save crash or corrupt equipment state.** `loadSave()` accepts arbitrary unlocked/current area IDs when the current ID is included in `unlockedAreas`; startup then requires that area to exist. Inventory migration also retains unknown item IDs and arbitrary equipped values. Normalize both against the area/equipment catalogs, validate equipped slot compatibility, and fall back to Area 1. Add migration fixtures for malformed and older saves.

2. **Medium — simulation owns live HP but persistence does not preserve an in-progress fight.** Every reload reconstructs each living spawn at rolled Max HP and the hero at full Max HP. If reload healing is not an explicit design choice, persist live combat state or document a deliberate safe-reset rule. Avoid persisting presentation state.

3. **Medium — `Game.ts` still owns gameplay consequences.** Reward application, equipment drops, boss completion, save writes, and some respawn wiring remain in the renderer-facing coordinator. This makes headless verification difficult and risks rule changes through presentation edits. Move each consequence behind a command/system and emit typed result events; leave `Game.ts` to compose and project them.

4. **Medium — gameplay has no regression suite.** Pure modules already expose deterministic seams, including injectable chance rolls, but there are no tests for affinity, dual-slot cooldowns, equipment damage/ascend math, save migrations, spawn rerolls/deadlines, gate crossing, lake collision, boss unlocks, or death/respawn. Establish a lightweight TypeScript test runner and cover these rules before balance/content expansion.

5. **Low — enemy and player collision only models area rectangles and the special lake barrier.** Authored fortress, rift, props, and other environment geometry do not constrain gameplay. This can permit visual clipping and makes future authored encounter spaces misleading. Add engine-neutral collision shapes to area data/runtime rather than reading Three.js meshes.

6. **Low — duplicated health rendering indicates coordinator drift.** `SpawnEntity.resetAfterHeroDefeat()` calls `renderHealth()` twice. It does not change gameplay, but should be removed when that presentation path is next touched.

## Verified strengths

- Spawn identity, per-life rolls, respawn state, and boss identity are explicit and data-driven.
- Hero attacks preserve independent cooldowns for both hands and orbit slots.
- Affinity affects hero damage only; enemy damage uses matching typed defense.
- Runtime movement and AI use plain positions rather than Three.js values.
- Daily reset preserves permanent stats, equipment, and unlocked progression while rerolling spawn lives.

## Recommended order

1. Harden and test save migration/normalization.
2. Add deterministic domain/system tests.
3. Extract reward, drop, boss, and persistence consequences from `Game.ts`.
4. Define authored collision only when environment encounter layouts require it.
