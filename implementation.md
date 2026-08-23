# Infuse: Evergrowth — implementation notes

## Product direction

Infuse: Evergrowth is an **active incremental RPG**. The player explores manually, defeats fixed world targets, and grows through permanent stat gains.

## Configuration sources

Gameplay tuning is intentionally separated from authored world content.

### `src/data/balance.json`

Single source of truth for tunable numeric values:

- hero base HP, damage, regeneration, movement speed, attack range/cooldown;
- Common enemy base attack;
- tier attack multipliers;
- tier respawn multipliers;
- respawn base duration;
- enemy attack growth formulas.

### `src/data/areas.json`

Authored world data:

- area IDs and names;
- world origins;
- 29 fixed spawn positions per area;
- group IDs;
- boss spawn IDs;
- per-spawn HP ranges and allowed permanent reward ranges;
- portal IDs, tags, destinations and unlock rules.

## Versioning

`package.json` is the app-version source of truth. The top-right UI version is populated from the package version at runtime rather than maintaining a second literal value.

Current package version: `0.45.0` → displayed as `0.45`.

## Enemy population and authored difficulty

Each current area has **29 fixed spawn points**. HP and permanent rewards are authored per spawn in `areas.json`; they do not use the old area/tier HP and reward formulas. On every revival, the spawn randomly selects HP within its range, then selects one allowed reward type and rolls that reward's amount. The complete roll is persisted for that life. Enemy attack damage retains the prior area/tier calculation.

Area 1 contains 10 Crystals and 15 Common enemies with 80–800 HP and either 1–10 Blunt or 2–20 Max HP rewards. Its three Uncommon enemies have 200, 500, and 2,000 HP, each rewarding 50 Max HP; the 2,000 HP Uncommon is the gate boss. Its Rare enemy has 4,500 HP and rewards 500 Max HP.

Area 2 contains 17 Crystals with 140–1,400 HP and either 1–10 Blunt or 4–40 Max HP rewards. Its seven Common enemies use those same options plus 1 HP/s regeneration. Three Uncommon enemies roll 3,000–4,000 HP and 10–50 Max HP. The 30,000 HP Rare boss rewards 1,000 HP/s regeneration, while the 18,000 HP Epic rewards 30 HP/s regeneration.

Crystals never retaliate. All combat enemies are human placeholders for now.

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

Current damage types:

- **Blunt** — bare hands and Area 1 enemy attacks; represented by a hammer icon.
- **Slash** — Area 2 enemy attacks; represented by a sword icon.
- **Pierce** — the displayed weakness for Area 2 enemies; represented by a spear icon.

Area 1 enemies are weak to Slash. Area 2 enemies are weak to Pierce. A hero hit matching the enemy's weakness deals **2× damage**, while the affinity the enemy is strong against deals **0.5× damage**. The remaining affinity deals normal damage. Individual spawns can override their area's weakness or set it to `null`; the Area 1 Legendary boss is affinity-neutral.

Enemy attacks do not apply affinity multipliers against the hero. Equipped helmets, armor, and boots instead provide flat damage reduction when their authored damage type matches the incoming attack. Matching gear can therefore reduce Slash, Blunt, or Piercing damage without doubling or halving the original attack.

Future weapons can introduce additional damage types and their own attack ranges.

## Respawn rules

Base first-kill respawn is **3 minutes**.

Per individual fixed spawn:

`respawn = 3 min × tier multiplier × 2^(killsToday - 1)`

At device-local midnight:

1. daily kill counters reset;
2. all dead targets respawn;
3. outstanding respawn timers are discarded;
4. new HP and reward values are rolled;
5. permanent player stats and area unlocks remain.

Each calculated respawn deadline is capped at the next local midnight.

### Group respawn indicator

When every member of a Common/Uncommon group is dead, a circular indicator appears at the group center. It drains from full to empty until the earliest member respawns, then disappears as soon as that member returns.

## Areas and portals

### Area 1

- 29 targets;
- Uncommon spawn `area1-uncommon-03` is the boss;
- gate `area1-to-area2` stays closed until that boss is defeated.

### Boss unlock flow

When the area boss is defeated, its ID and the target-area unlock are persisted, boss-gated passages open, and the camera briefly focuses on the newly opened gate.

### Area 2

- 29 targets;
- Rare spawn `area2-rare-01` is the boss;
- its return gate to Area 1 is always open.

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
