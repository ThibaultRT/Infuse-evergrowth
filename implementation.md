# Infuse: Evergrowth — implementation notes

## Product direction

Infuse: Evergrowth is an **active incremental RPG**. The player explores manually, fights or infuses fixed world targets, and grows through repeated victories. It is not designed around artificial paywalls or excessive idle waiting.

## v0.1 map population

The first map contains exactly **30 fixed spawn points**:

| Tier | Count | Grouping |
| --- | ---: | --- |
| Crystal | 6 | Fixed non-hostile objects |
| Common | 14 | Two packs: 6 + 8 |
| Uncommon | 4 | Two packs: 2 + 2 |
| Rare | 3 | Singles |
| Epic | 2 | Singles |
| Legendary | 1 | Single |

Spawn positions and tiers are authored data and do not randomize.

## Enemy tiers

Tier order:

`Crystal < Common < Uncommon < Rare < Epic < Legendary`

Higher tiers increase combat stats and the permanent-stat reward.

Crystals are a special tier:

- fixed objects rather than humans;
- never move;
- never retaliate;
- smallest reward tier.

All combat enemies are human placeholders in v0.1. Skins/species can be replaced later without changing spawn/tier logic.

### Permanent stat rewards

Enemies do **not** drop Essence or another intermediary currency. Defeating a target directly increases one permanent hero stat: **Max HP** or **Attack**, chosen 50/50 for now.

| Tier | Stat multiplier | Permanent stat reward | Respawn multiplier |
| --- | ---: | ---: | ---: |
| Crystal | 0.35x | +0.50 HP or ATK | 1x |
| Common | 1x | +1.00 HP or ATK | 1x |
| Uncommon | 2.25x | +1.25 HP or ATK | 3x |
| Rare | 4.5x | +1.50 HP or ATK | 6x |
| Epic | 8x | +1.75 HP or ATK | 9x |
| Legendary | 14x | +2.00 HP or ATK | 15x |

These reward values are initial balancing placeholders. The important rule is that Commons grant exactly **+1 HP or +1 Attack**, while higher tiers scale only gradually.

The stats tracking page keeps and displays decimal precision to two decimal places. In the active game/combat HUD, HP and Attack are displayed as rounded whole numbers. Enemy health bars are small world-space overlays with no names or numeric values.

### Stat source model

Player stats are stored as source-aware values rather than a single flattened number. Each tracked stat contains:

- a `base` value;
- additive sources such as `kills`, `equipment`, and `other`;
- multiplicative sources such as `equipment` and `other`.

Calculation order:

`total = (base + sum(additive sources)) × product(multiplicative sources)`

The source maps are intentionally extensible so future systems can add named sources without changing the calculation model.

Current base stats:

- Max HP: `120.00`;
- Attack: `20.00`;
- Health regeneration: `0.10 HP/s`.

Kills add only to the `kills` additive source for Max HP or Attack. Existing v0.1 saves are migrated so previous kill gains remain preserved under that source.

Health regeneration restores the current hero HP continuously up to Max HP. It uses the same base/additive/multiplicative source model and is persisted like the other stats.

## Respawn rules

Base first-kill respawn is **3 minutes**.

For a given fixed spawn point, each additional defeat on the same local calendar day doubles its own timer:

`respawn = 3 min × tier multiplier × 2^(killsToday - 1)`

Examples for a Common spawn:

- first defeat: 3 min
- second defeat: 6 min
- third defeat: 12 min
- fourth defeat: 24 min

Examples for an Uncommon spawn:

- first defeat: 9 min
- second defeat: 18 min
- third defeat: 36 min

### Midnight reset

Midnight is based on the device's **local calendar time**.

At local midnight:

1. all `killsToday` counters reset to zero;
2. all dead enemies/crystals respawn immediately;
3. all outstanding respawn timers are discarded;
4. permanent hero stats are **not** reset.

Therefore a target may be killed at `23:59:50` and be alive again at `00:00:00`, allowing another kill at `00:00:01`.

Implementation rule: every calculated `respawnAt` is capped to the next local midnight.

### v0.1 assumption

Respawn escalation is **per individual fixed spawn point**, not per pack. This is intentionally documented so it can be changed later if pack-level timers feel better.

## Hero

The hero is human with an original stylized anime-fantasy look. v0.1 uses primitive low-poly geometry; no third-party character assets are required.

Starting state:

- 120.00 Max HP;
- 20.00 Attack;
- 0.10 HP/s passive health regeneration;
- starter underwear only;
- two unlocked hand weapon slots;
- two additional locked weapon slots;
- the future extra slots are intended for weapons that float/orbit and follow the hero while the first two weapons remain hand-held.

v0.1 has no actual equipment items yet. The four slots are exposed in the HUD so the model is part of the architecture from the beginning.

## Controls

Mobile-first:

- centered virtual joystick: movement;
- no attack button;
- the hero automatically attacks the nearest living target within the current weapon range;
- bare-hand range in v0.2: `2.15` world units;
- future weapons may provide different ranges, including long-range bows;
- Stats button: open the permanent-stat tracking page.

Desktop development controls:

- WASD / arrow keys: movement;
- attacks are automatic under the same range/cooldown rules.

## Persistence

v0.2 stores locally:

- source-aware Max HP, Attack, and Health Regeneration, including decimal precision;
- additive gains by named source (currently kills/equipment/other);
- multiplicative modifiers by named source (currently equipment/other);
- daily key;
- per-spawn kills today;
- per-spawn respawn deadline.

Storage is local to the browser. Cloud saves/accounts are intentionally out of scope for this slice.

## v0.2 presentation changes

- Camera is pulled farther back to show significantly more of the surrounding map.
- Enemy/target health is represented by a compact bar projected above the target in the world.
- Target health bars intentionally show no target name and no numeric HP value.
