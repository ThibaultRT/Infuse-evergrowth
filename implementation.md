# Infuse: Evergrowth — implementation notes

## Product direction

Infuse: Evergrowth is an **active incremental RPG**. The player explores manually, defeats fixed world targets, and grows through permanent stat gains.

## Configuration sources

Gameplay tuning is intentionally separated from authored world content.

### `src/data/balance.json`

Single source of truth for tunable numeric values:

- hero base HP, damage, regeneration, movement speed, attack range/cooldown;
- Common enemy base HP and attack;
- tier stat multipliers;
- tier permanent-stat rewards;
- tier respawn multipliers;
- loot roll weights;
- respawn base duration;
- cross-area growth formulas.

### `src/data/areas.json`

Authored world data:

- area IDs and names;
- world origins;
- 30 fixed spawn positions per area;
- group IDs;
- boss spawn IDs;
- portal IDs, tags, destinations and unlock rules.

## Versioning

`package.json` is the app-version source of truth. The top-right UI version is populated from the package version at runtime rather than maintaining a second literal value.

Current package version: `0.32.0` → displayed as `0.32`.

## Enemy population

Each current area contains exactly **30 fixed spawn points**:

| Tier | Count | Grouping |
| --- | ---: | --- |
| Crystal | 6 | Fixed non-hostile objects |
| Common | 14 | Two packs: 6 + 8 |
| Uncommon | 4 | Two packs: 2 + 2 |
| Rare | 3 | Singles |
| Epic | 2 | Singles |
| Legendary | 1 | Single / area boss |

Tier order:

`Crystal < Common < Uncommon < Rare < Epic < Legendary`

Crystals never retaliate. All combat enemies are human placeholders for now.

## Area scaling

Common enemies define the per-area baseline. Tier multipliers apply after area scaling.

```text
Common HP(area) = commonBaseHp × hpGrowthPerArea^(area - 1)
Common Attack(area) = commonBaseAttack × area × attackMultiplierPerArea
Enemy HP = Common HP(area) × tier stat multiplier
Enemy Attack = Common Attack(area) × tier stat multiplier
```

Current balance values:

- Common base HP: `32`;
- Common base Attack: `2`;
- HP area growth: `4.65×`;
- Attack area growth: linear (`base × area`).

Approximate checkpoints:

- Area 1 Common: `32 HP`;
- Area 2 Common: `149 HP`;
- Area 15 Common: `70.7B HP`;
- Area 15 Legendary: `~990B HP`.

This curve is chosen to support roughly 15 areas and finish in the billions / near-one-trillion range rather than using `pow(default, area)`, which would grow far too quickly with a default HP of 32.

## Permanent stat rewards

Enemies do not drop an intermediary Essence currency. Defeating a target directly increases one permanent hero stat: **Max HP** or **Blunt Attack**.

| Tier | Stat multiplier | Permanent stat reward | Respawn multiplier |
| --- | ---: | ---: | ---: |
| Crystal | 0.35x | +0.50 HP or Blunt | 1x |
| Common | 1x | +1.00 HP or Blunt | 1x |
| Uncommon | 2.25x | +1.25 HP or Blunt | 3x |
| Rare | 4.5x | +1.50 HP or Blunt | 6x |
| Epic | 8x | +1.75 HP or Blunt | 9x |
| Legendary | 14x | +2.00 HP or Blunt | 15x |

Each target rolls HP vs Blunt once per life. The rolled reward is displayed above the target HP bar as value + icon and is rerolled on respawn.

Stats keep decimal precision internally and in the Stats panel. Combat HUD values are rounded to integers.

## Stat source model

Each player stat stores:

- `base`;
- additive sources (`kills`, `equipment`, `other`);
- multiplicative sources (`equipment`, `other`).

Calculation order:

`total = (base + sum(additive sources)) × product(multiplicative sources)`

Current hero base stats:

- Max HP: `20.00`;
- Blunt Attack: `5.00`;
- Health regeneration: `0.10 HP/s`.

## Damage types

Attack values are stored by damage type.

Current damage type:

- **Blunt** — bare hands and Area 1 enemy attacks; represented by a hammer icon.
- **Slash** — Area 2 enemy attacks; represented by a sword icon.
- **Pierce** — the displayed weakness for Area 2 enemies; represented by a spear icon.

Area 1 enemies are weak to Slash. Area 2 enemies are weak to Pierce. Weaknesses are surfaced in the HUD for loadout planning; damage modifiers will be applied when those hero damage types become available.

Future weapons can introduce additional damage types and their own attack ranges.

## Respawn rules

Base first-kill respawn is **3 minutes**.

Per individual fixed spawn:

`respawn = 3 min × tier multiplier × 2^(killsToday - 1)`

At device-local midnight:

1. daily kill counters reset;
2. all dead targets respawn;
3. outstanding respawn timers are discarded;
4. new loot is rolled;
5. permanent player stats and area unlocks remain.

Each calculated respawn deadline is capped at the next local midnight.

### Group respawn indicator

When every member of a Common/Uncommon group is dead, a circular indicator appears at the group center. It drains from full to empty until the earliest member respawns, then disappears as soon as that member returns.

## Areas and portals

### Area 1

- 30 targets;
- Legendary spawn `area1-legendary-01` is the boss;
- contains portal `area1-to-area2`;
- portal tag: `portal - area 2`;
- portal target: Area 2;
- portal is closed until Area 1's boss is defeated.

### Boss unlock flow

When the area boss is defeated:

1. its boss ID is persisted in `defeatedBosses`;
2. all boss-gated portals originating from that area open;
3. their target areas are added to `unlockedAreas`;
4. the camera temporarily focuses on the first newly opened portal;
5. control resumes;
6. walking into an open portal changes `currentAreaId` and places the hero in the destination area.

Portal definitions are destination-based, so several portals from several source areas may point to the same target area without special-case code.

### Area 2

- another 30-target map with the same tier/group structure;
- world layout is similar to Area 1;
- enemies grant twice the permanent-stat rewards of equivalent Area 1 enemies;
- contains an always-open portal at the bottom of the map that returns to Area 1;
- enemy HP and attack are calculated from Area 2 scaling rather than duplicated values;
- Area 2 has its own Legendary boss ID ready for later progression logic.

## Hero and controls

Hero:

- human low-poly placeholder;
- starter underwear;
- two unlocked hand weapon slots;
- two locked orbit weapon slots.

Controls:

- centered virtual joystick on mobile;
- WASD / arrow keys on desktop;
- no attack button;
- hero automatically attacks the nearest living target within the active weapon range.

Current bare-hand range: `2.15` world units.

## Equipment / inventory groundwork

Bottom dock contains four equipment slots side-by-side and an **Inventory** button. The Inventory window already represents equipped slots and a bag collection but no actual equipment items exist yet.

## Presentation / combat feedback

- zoomed-out camera;
- compact target HP bars without names/numeric HP;
- target loot value + icon above HP bar;
- player hit text: whole-number damage + damage-type icon;
- incoming hit text: red negative damage + damage-type icon;
- stat gains: number + icon only on the right-side cascading stack;
- portal opening triggers a short camera focus.

## Persistence

v0.32 uses save schema `7` and intentionally does not migrate earlier development saves.

Stored locally:

- source-aware player stats;
- inventory/equipped state;
- current area;
- unlocked areas;
- defeated boss IDs;
- daily spawn state;
- respawn/defeat timestamps;
- per-life loot rolls.
