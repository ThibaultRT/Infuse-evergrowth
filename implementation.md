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

All combat enemies are human placeholders for now. Skins/species can be replaced later without changing spawn/tier logic.

### Permanent stat rewards

Enemies do **not** drop Essence or another intermediary currency. Defeating a target directly increases one permanent hero stat: **Max HP** or **Blunt Attack**.

| Tier | Stat multiplier | Permanent stat reward | Respawn multiplier |
| --- | ---: | ---: | ---: |
| Crystal | 0.35x | +0.50 HP or Blunt | 1x |
| Common | 1x | +1.00 HP or Blunt | 1x |
| Uncommon | 2.25x | +1.25 HP or Blunt | 3x |
| Rare | 4.5x | +1.50 HP or Blunt | 6x |
| Epic | 8x | +1.75 HP or Blunt | 9x |
| Legendary | 14x | +2.00 HP or Blunt | 15x |

Commons grant exactly **+1 HP or +1 Blunt Attack**, while higher tiers scale only gradually.

In v0.31, each target rolls its reward once when it spawns. The rolled reward is saved for that life and displayed above the target HP bar as only a value plus icon:

- heart icon = Max HP;
- hammer icon = Blunt Attack.

After the target respawns, its next reward is rolled again.

The stats tracking page keeps and displays decimal precision to two places. Active combat values are displayed as rounded whole numbers.

### Stat source model

Player stats are stored as source-aware values rather than a single flattened number. Each tracked stat contains:

- a `base` value;
- additive sources such as `kills`, `equipment`, and `other`;
- multiplicative sources such as `equipment` and `other`.

Calculation order:

`total = (base + sum(additive sources)) × product(multiplicative sources)`

Current base stats:

- Max HP: `120.00`;
- Blunt Attack: `5.00`;
- Health regeneration: `0.10 HP/s`.

Kills add only to the `kills` additive source for Max HP or Blunt Attack.

Health regeneration restores current hero HP continuously up to Max HP and uses the same source model.

### Damage types

Attack stats are stored by damage type rather than as one generic Attack number.

Current damage types:

- **Blunt** — used by bare hands and all current enemy attacks, represented by a hammer icon.

Bare hands currently deal only Blunt damage. Future weapons can introduce additional damage types and their own attack ranges.

v0.31 combat feedback:

- hero hits: floating whole-number damage + damage-type icon over the target;
- enemy hits: floating red negative whole-number damage + damage-type icon over the hero.

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

### Group respawn indicator

Common and Uncommon packs have explicit group IDs.

When **every member of one group is dead**, v0.31 shows a circular countdown at the group center:

- the circle is full when the last group member dies;
- it drains continuously;
- the countdown targets the **earliest scheduled respawn** among the dead members;
- as soon as one member respawns, the group is no longer fully dead and the indicator disappears.

`defeatedAt` is persisted per spawn so the circular progress remains correct after reopening the PWA.

### Midnight reset

Midnight is based on the device's **local calendar time**.

At local midnight:

1. all `killsToday` counters reset to zero;
2. all dead enemies/crystals respawn immediately;
3. all outstanding respawn timers are discarded;
4. new loot is rolled for each spawn;
5. permanent hero stats are **not** reset.

Therefore a target may be killed at `23:59:50` and be alive again at `00:00:00`, allowing another kill at `00:00:01`.

Implementation rule: every calculated `respawnAt` is capped to the next local midnight.

Respawn escalation remains **per individual fixed spawn point**, not per pack.

## Hero

The hero is human with an original stylized anime-fantasy look. Current visuals use primitive low-poly geometry.

Starting state:

- 120.00 Max HP;
- 5.00 Blunt Attack from bare hands;
- 0.10 HP/s passive health regeneration;
- starter underwear only;
- two unlocked hand weapon slots;
- two additional locked orbit weapon slots.

Future orbit weapons are intended to float/follow the hero while the first two weapons remain hand-held.

## Equipment and inventory

v0.31 moves the four equipment squares out of the top HUD and into a compact bottom dock:

- Hand 1;
- Hand 2;
- Orbit 1 (locked);
- Orbit 2 (locked).

An **Inventory** button opens a dedicated equipment window with:

- the four equipped slots;
- an inventory/bag area;
- persistent inventory/equipped state in the save model.

There are no actual equipment items yet; the UI/data structure is ready for later item drops and equip interactions.

## Controls

Mobile-first:

- centered virtual joystick: movement;
- no attack button;
- the hero automatically attacks the nearest living target within the current weapon range;
- bare-hand range: `2.15` world units;
- future weapons may provide different ranges, including long-range bows;
- Stats button: open permanent-stat tracking;
- Inventory button: open equipment/inventory.

Desktop development controls:

- WASD / arrow keys: movement;
- attacks are automatic under the same range/cooldown rules.

## Persistence

v0.31 uses save schema/version `5` and stores locally:

- source-aware Max HP, damage-type Attack stats, and Health Regeneration;
- additive and multiplicative stat sources;
- inventory items and equipped-slot references;
- daily key;
- per-spawn kills today;
- per-spawn respawn deadline;
- per-spawn defeat timestamp;
- current per-life loot roll.

During early development, save migrations are intentionally not maintained. A schema/save-key change may start the player from a fresh save.

Storage is local to the browser. Cloud saves/accounts are intentionally out of scope for this slice.

## Presentation

- Camera is pulled back to show more surrounding map.
- Each living target has a compact floating HP bar with no name or numeric HP.
- Loot value + icon appears directly above the target HP bar.
- Fully defeated packs show the circular group respawn countdown.
- Combat damage text floats briefly at the hit location.
- v0.31 displays a tiny `0.31` version marker in the top-right corner.
