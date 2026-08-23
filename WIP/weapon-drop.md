# Weapon Drops / Ascend — Remaining Design Differences

## Status

The original weapon-drop implementation plan is now overwhelmingly implemented and no longer needs to remain as a historical specification.

Implemented in the current code/data/UI:

- Swords, Hammers, Spears, armor, all five rarities, and stable item IDs;
- area-specific equipment loot tables with inheritance;
- enemy-tier equipment eligibility and rarity ceilings;
- configured area-scaled drop chances;
- separate static equipment definitions and persistent owned state;
- duplicate-copy Level progression and Level 50 Ascend threshold;
- copies beyond the threshold are preserved through level overflow and carried into the next Ascend rather than discarded;
- independent hand attack scheduling and explicit damage types;
- same owned item cannot occupy two equipment slots simultaneously;
- equipment-drop popup and inventory detail UI;
- Level / Ascend display, equip/unequip actions, calculated stats, and hidden-power placeholder;
- bare hands currently use 3 Blunt damage at a 1.0 s cadence;
- the later graphical work also added equipment visuals and orbit behavior that were outside the original V1 scope.

The durable equipment architecture and data locations are summarized in `AGENTS.md` and `README.md`.

This file is retained **only because two original agreed rules do not match the current implementation**. Once those are intentionally resolved, delete this file.

## Difference 1 — equipped weapons currently add permanent hero damage

Original agreed rule:

> An equipped weapon attack uses that weapon's calculated damage only. Bare-hand damage is only used by an empty hand.

Current `src/systems/EquipmentSystem.ts` behavior:

```ts
{ damage: equipmentDamage(item, owned) + heroDamage(item.damageType), ... }
```

So an equipped weapon currently adds the player's permanent attack value for that damage type.

This matters especially for Blunt weapons because permanent kill rewards currently grow the hero's Blunt stat. A hammer therefore receives both its equipment damage and the hero's accumulated Blunt damage, while Slash/Piercing weapons only receive an equivalent bonus if those hero stat sources exist.

### Decision required

Choose one and then make code/docs consistent:

1. **Restore the original rule:** equipped weapons deal `equipmentDamage(...)` only; empty hands use `heroDamage('blunt')`.
2. **Keep the current additive-stat rule intentionally:** document hero attack stats as a weapon additive source and ensure the progression system can grow Slash/Piercing stats fairly rather than creating a hidden Blunt-only advantage.

Do not delete this WIP until this is decided.

## Difference 2 — per-level growth currently doubles every Ascend

Original agreed rule:

- a new Ascend starts at **2× the previous Ascend's Level 50 damage**;
- `damagePerLevel` stays unchanged across Ascends;
- only the new Ascend base receives the large power jump.

Current `src/domain/items/EquipmentProgression.ts` multiplies per-level growth by:

```text
perLevelMultiplierPerAscend ^ ascend
```

and `src/data/balance.json` currently sets:

```json
"perLevelMultiplierPerAscend": 2
```

So both the Ascend base and the per-level gain scale upward. That is stronger than the original formula.

### Decision required

Choose one and then make code/data/docs consistent:

1. **Restore the original formula:** keep per-level growth constant across Ascends and retain only the 2× new-base rule.
2. **Keep the current stronger scaling intentionally:** treat `perLevelMultiplierPerAscend` as an explicit balance rule and document it as such.

## Deletion condition

Delete `WIP/weapon-drop.md` after the two differences above have explicit product decisions and the resulting rules are reflected in code plus `AGENTS.md`/`README.md` where appropriate.
