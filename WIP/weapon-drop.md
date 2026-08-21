# Weapon Drops, Dual-Hand Combat, and Ascension — Implementation Plan

## Status

WIP design/implementation plan. This document is intentionally data-driven and should be implemented without putting another large feature block directly into `Game.ts`.

## Goals

Add a scarce, random equipment-drop loop while preserving the existing permanent stat reward from kills.

The system must:

- add Swords, Hammers, and Spears;
- support Common, Uncommon, Rare, Epic, and Legendary equipment;
- use area-specific equipment loot pools so early areas cannot drop later-game equipment;
- keep equipment drops rare;
- let stronger enemy tiers roll progressively higher equipment rarities;
- keep both hero hands independent for attacks and cooldowns;
- support empty-hand attacks alongside equipped weapons;
- level a weapon from duplicate drops;
- replace the old `upgrade` concept with `ascend`;
- reset weapon level on Ascend and create a large power jump;
- provide a large drop popup and an inventory weapon-detail view;
- remain lightweight enough for Safari/iPhone.

## Core design decisions

### Existing kill reward stays

Equipment is an additional rare reward layer.

An enemy defeat continues to grant its existing permanent HP / attack reward. The equipment-drop system runs separately after a valid enemy defeat.

### Equipment rarity and enemy rarity are separate concepts

Enemy rarity determines the highest equipment rarity that may be rolled.

Area determines which specific equipment IDs are available at all.

This is important: a Legendary item from Area 1 is not necessarily an end-game Legendary. Later areas may introduce stronger Legendary items while Area 1 remains limited to its own authored loot pool.

### Damage types

Use exactly these weapon damage types:

- Bare hand: `blunt`
- Hammer: `blunt`
- Sword: `slash`
- Spear: `piercing`

Extend the current damage type union from only `blunt` to:

```ts
type DamageType = 'blunt' | 'slash' | 'piercing';
```

Do not introduce a generic hero attack value that is added to every weapon hit.

An equipped weapon attack uses that weapon's calculated damage only.

An empty hand uses the bare-hand damage only.

## Dual-hand combat

Both hand slots are active and independent.

Each hand has its own:

- equipped item or empty state;
- damage profile;
- damage type;
- attack cooldown;
- cooldown timer.

Examples:

- Hand 1 empty: bare-hand attack for 3 Blunt every 1.0 s.
- Hand 2 has a Hammer: Hammer damage every 1.5 s.
- Both can attack independently whenever their own cooldown is ready.

Two empty hands therefore each behave as a bare hand rather than treating the hero as one combined unarmed weapon.

### Bare-hand baseline

Change the hero bare-hand values to:

```text
Damage: 3 Blunt
Cooldown: 1.0 s per empty hand
```

This replaces the current 5 damage / 0.5 s behavior.

Bare hands are not inventory items and do not have levels or Ascend values.

### Per-hand attack loop

Replace the single `heroAttackCooldown` with per-hand runtime cooldowns, for example:

```ts
handCooldowns = {
  hand1: 0,
  hand2: 0
};
```

For each hand every frame:

1. reduce only that hand's cooldown;
2. if it is ready, derive the hand attack profile;
3. find a valid target in range;
4. apply that attack's damage and damage type;
5. reset that hand to its own cooldown.

Re-evaluate the target for each ready hand. If Hand 1 kills the nearest enemy, Hand 2 may then attack the next valid enemy instead of hitting an already-dead target.

The cost is trivial: at most two normal target checks per combat opportunity.

### Equipping the same owned item twice

A weapon definition represents one owned/upgraded weapon entry; duplicate drops increase that entry's level rather than creating another physical copy.

Therefore the same item ID cannot occupy both hands at the same time.

Equipping an item already present in the other hand moves it to the selected hand and leaves the old hand empty.

## Weapon classes

Initial attack cooldowns:

| Class | Damage type | Attack cooldown |
| --- | --- | ---: |
| Bare hand | Blunt | 1.00 s |
| Sword | Slash | 1.00 s |
| Spear | Piercing | 1.25 s |
| Hammer | Blunt | 1.50 s |

The 1.25 s Spear cooldown is an initial tuning value because no Spear speed has been specified yet. Keep it in data so it is trivial to change.

For V1, do not add weapon-specific range behavior. All three weapon classes can use the current hero attack range. A longer Spear range can be a later balance feature.

## Initial equipment catalog

Create 15 equipment definitions: 5 rarities for each of the 3 weapon classes.

Names below are working names and can be changed without changing stable IDs.

| Rarity | Sword | Hammer | Spear |
| --- | --- | --- | --- |
| Common | Iron Edge | Iron Maul | Iron Pike |
| Uncommon | Briarblade | Rootbound Maul | Thornlance |
| Rare | Stormfang | Tempest Maul | Stormspike |
| Epic | Nightbloom | Voidbreaker | Nightthorn |
| Legendary | Verdant Eternity | Worldroot | Worldspine |

Stable IDs should be independent of display names, for example:

```text
sword-common-iron-edge
hammer-common-iron-maul
spear-common-iron-pike
```

Do not derive save identity from the item name.

## Equipment data

Add a human-readable equipment catalog, preferably:

```text
src/data/equipment.json
```

Each item should contain at least:

```json
{
  "id": "sword-common-iron-edge",
  "name": "Iron Edge",
  "weaponClass": "sword",
  "rarity": "common",
  "damageType": "slash",
  "baseDamage": 3,
  "damagePerLevel": 3,
  "attackCooldownSeconds": 1.0,
  "image": "..."
}
```

Keep the item values on the item definition rather than assuming every future weapon of the same rarity must have identical stats. Later areas need to be able to introduce stronger equipment at the same rarity.

### Initial rarity damage curve

Use this as the first-pass tuning for the 15 starter items. It is intentionally data-driven and easy to rebalance.

| Rarity | Base damage | Damage per level |
| --- | ---: | ---: |
| Common | 3 | +3 |
| Uncommon | 5 | +4 |
| Rare | 8 | +6 |
| Epic | 13 | +9 |
| Legendary | 21 | +13 |

For the initial implementation, the three weapon classes may share the same rarity damage curve. Their first differentiation is damage type and cooldown. Future special powers can create stronger class identity without complicating V1.

## Area-specific equipment loot tables

Do not put one global equipment pool behind every area.

Add a dedicated human-readable file, for example:

```text
src/data/equipment-loot-tables.json
```

The loot table must be authored per area.

Recommended lightweight structure:

```json
{
  "areas": {
    "1": {
      "items": [
        "sword-common-iron-edge",
        "hammer-common-iron-maul",
        "spear-common-iron-pike"
      ]
    },
    "2": {
      "inherits": 1,
      "add": []
    }
  }
}
```

Area 1 receives the starter equipment intended for Area 1.

Later areas may inherit the previous area's pool and append newly unlocked equipment, for example:

```json
{
  "3": {
    "inherits": 2,
    "add": [
      "sword-rare-area3-example",
      "hammer-epic-area3-example"
    ]
  }
}
```

This provides two useful properties:

1. later areas naturally open more equipment;
2. equipment cannot leak into an earlier area unless its ID is explicitly present there.

If a future area needs a completely different table instead of cumulative unlocks, allow it to define `items` directly instead of `inherits` + `add`.

The current 15 weapons should be treated as the starter family. They can all be valid Area 1 gear; future stronger items are added to later area tables rather than making the starter Legendary items synonymous with end-game gear.

## Equipment drop algorithm

Run equipment RNG once per eligible enemy death, not per frame.

The algorithm is intentionally tiny:

```text
enemy defeated
  -> equipment eligible?
  -> drop roll
  -> build valid rarity weights for enemy tier + current area pool
  -> rarity roll
  -> choose one item uniformly from that rarity in the area pool
  -> quantity roll (currently always 1)
  -> apply drop to owned equipment
  -> emit equipmentDropped
```

This requires only a few random numbers per eligible kill and has negligible CPU cost.

### Eligibility

| Enemy tier | Equipment drop? | Highest possible item rarity |
| --- | --- | --- |
| Crystal | No | — |
| Common | No | — |
| Uncommon | Yes | Uncommon |
| Rare | Yes | Rare |
| Epic | Yes | Epic |
| Legendary | Yes | Legendary |

Crystals are excluded from equipment drops.

Common enemies are explicitly excluded from equipment drops.

## First roll: does equipment drop?

Area 1 base chances:

| Enemy tier | Area 1 equipment chance |
| --- | ---: |
| Uncommon | 1% |
| Rare | 2% |
| Epic | 4% |
| Legendary | 8% |

Use the agreed area multiplier:

```text
areaMultiplier = min(1 + 0.15 * (areaId - 1), 3)
finalDropChance = baseTierChance * areaMultiplier
```

Examples:

```text
Area 1: x1.00
Area 5: x1.60
Area 10: x2.35
Late game cap: x3.00
```

Store all values in balance data rather than hardcoding them in the drop system.

## Second roll: equipment rarity

Start with these weights:

| Enemy tier | Common | Uncommon | Rare | Epic | Legendary |
| --- | ---: | ---: | ---: | ---: | ---: |
| Uncommon | 70% | 30% | — | — | — |
| Rare | 40% | 40% | 20% | — | — |
| Epic | 20% | 30% | 30% | 20% | — |
| Legendary | 10% | 15% | 20% | 25% | 30% |

### Interaction with area loot tables

Before rolling rarity:

1. resolve the current area's effective item pool;
2. group available items by rarity;
3. take the enemy-tier rarity weights;
4. remove any rarity with zero available items in that area;
5. normalize the remaining weights;
6. roll rarity from those remaining entries.

This means a successful equipment drop never has to be thrown away merely because the current area's authored pool does not contain one of the theoretical rarities.

It also preserves the enemy's rarity ceiling.

If the area contains no equipment compatible with that enemy at all, return no equipment safely.

## Third roll: item selection

After rarity is chosen, select uniformly from the current area's equipment IDs of exactly that rarity.

For example:

```text
rolled rarity = Rare
Area 4 Rare pool = [Rare Sword A, Rare Sword B, Rare Hammer A, Rare Spear A]
-> each currently has 25% chance
```

Do not maintain fixed enemy -> fixed weapon mappings for normal equipment.

Unique boss drops can be added later as a separate override system if desired.

## Drop quantity

Use a quantity field from day one even though V1 always returns:

```text
quantity = 1
```

This keeps a cheap future balance lever for later areas where a rare drop could grant x2, x3, etc. levels without increasing equipment-drop frequency.

## Owned weapon state

Replace the current minimal inventory entry with equipment progression state, conceptually:

```ts
type OwnedEquipment = {
  itemId: string;
  level: number;
  ascend: number;
  bankedCopies: number;
};
```

The catalog owns static values such as name, rarity, image, base damage, class, and cooldown.

The save owns only progression/state.

## Duplicate drops and weapon level

First drop:

```text
not owned -> Level 1, Ascend 0
```

Each subsequent copy increases level by the drop quantity.

Example:

```text
Level 7 + x1 -> Level 8
Level 12 + x3 -> Level 15
```

Level is capped at 50 for the current Ascend.

### Do not waste copies at the Level 50 cap

If the player receives additional copies while the weapon is already Level 50, bank them instead of discarding them.

After the player Ascends, apply banked copies to the new level progression.

This prevents a rare equipment drop from being wasted simply because the player had not pressed the Ascend button yet.

## Ascend system

Use the word **Ascend** everywhere in UI, types, events, and documentation for this mechanic.

Do not call it `upgrade`.

Examples of item progression labels:

```text
Level 5 · Ascend 0
Level 5 · Ascend 2
```

### Ascend requirement

Initial requirement for every rarity:

```text
Level 50
```

At Level 50, enable the Ascend button.

### Ascend behavior

When the player Ascends:

1. increment `ascend` by 1;
2. reset level to 1;
3. apply any banked copies;
4. calculate the new Ascend base damage using the power-surge rule.

### Damage formula

For an item with authored:

```text
B = baseDamage
G = damagePerLevel
```

At Ascend 0:

```text
baseAtAscend(0) = B
damage(level, 0) = B + (level - 1) * G
```

Each new Ascend starts at twice the Level 50 damage of the previous Ascend:

```text
baseAtAscend(A + 1) = 2 * damage(50, A)
damage(level, A) = baseAtAscend(A) + (level - 1) * G
```

For V1, keep `damagePerLevel` unchanged across Ascends. Only the base damage receives the large Ascend power surge. This matches the requested rule without introducing another scaling factor.

Example for a Common weapon with base 3 and +3 per level:

```text
Ascend 0, Level 1  = 3
Ascend 0, Level 50 = 150

Ascend 1, Level 1  = 300
Ascend 1, Level 50 = 447

Ascend 2, Level 1  = 894
```

This is lightweight to calculate. Ascend values will be small, and the base can be derived from the immutable item data plus the Ascend count rather than duplicating derived damage in the save.

## Inventory behavior

Keep Hand 1 and Hand 2 both unlocked and functional.

Orbit slots remain outside the scope of this feature.

### Inventory list

Owned equipment should show at least:

- image/icon;
- name;
- rarity;
- level;
- Ascend count;
- equipped-hand indicator if relevant.

### Weapon detail page

Clicking an owned weapon opens a dedicated detail view inspired by the supplied benchmark screenshot.

Show:

- large weapon image;
- weapon name;
- rarity;
- weapon class;
- damage type;
- `Level X`;
- `Ascend X`;
- current calculated damage;
- attack cooldown;
- damage gained per level;
- equipped state / hand;
- Equip Hand 1 / Equip Hand 2 action;
- Ascend button;
- special-power section.

Before the first Ascend, the power section reads exactly:

```text
Hidden power will be unlocked upon Ascend
```

After Ascend, a temporary V1 placeholder can state that the power is unlocked but its ability is not implemented yet.

### Equip rules

- Equip actions target Hand 1 or Hand 2 explicitly.
- Equipping into a populated hand replaces that hand's weapon.
- Equipping an item already in the other hand moves it instead of duplicating it.
- Emptying a hand immediately restores that hand's bare-hand attack profile.

## Equipment drop popup

When equipment is looted, show a large HTML/CSS popup over gameplay.

Do not render this popup in Three.js.

The popup should include:

- large weapon image;
- weapon name;
- rarity styling;
- quantity dropped, e.g. `x1`;
- previous and new progression state when already owned;
- current level and Ascend.

Examples:

```text
STORMFANG
Rare Sword
x1
Level 7 -> 8 · Ascend 0
```

First acquisition:

```text
IRON EDGE
Common Sword
x1
NEW · Level 1 · Ascend 0
```

At cap:

```text
WORLDROOT
Legendary Hammer
x1
Level 50 · Ascend 0
+1 copy banked · ASCEND READY
```

The popup should be celebratory but non-blocking:

- do not pause combat;
- use `pointer-events: none` for the notification layer;
- display for roughly 1.5-2.0 seconds;
- queue notifications if several are generated close together.

## HUD consequence of independent hands

The current HUD exposes one Blunt attack value. That is no longer sufficient once two hands can have different damage, cooldowns, and damage types.

Do not display one misleading combined attack number.

Replace or extend that section with two compact hand summaries, for example:

```text
H1: 3 Blunt / 1.0 s
H2: 21 Slash / 1.0 s
```

Exact visual styling can remain simple for V1; correctness matters more than polish.

## Events

Extend the typed event bus rather than directly coupling drop logic to UI.

Suggested events:

```ts
equipmentDropped: {
  sourceId: string;
  areaId: number;
  itemId: string;
  quantity: number;
  previousLevel: number | null;
  newLevel: number;
  ascend: number;
};

equipmentEquipped: {
  itemId: string;
  hand: 'hand1' | 'hand2';
};

weaponAscended: {
  itemId: string;
  previousAscend: number;
  newAscend: number;
};
```

The equipment popup listens to `equipmentDropped`.

Inventory UI refreshes from saved state rather than owning gameplay state.

## Suggested modules

Do not put the full feature into `Game.ts`.

A reasonable first implementation can stay compact:

```text
src/
  data/
    equipment.json
    equipment-loot-tables.json
    balance.json

  systems/
    EquipmentDropSystem.ts
    EquipmentSystem.ts

  ui/
    equipment.ts

  game/
    GameEvents.ts
```

If the larger architecture cleanup has not yet created `systems/` and `ui/` submodules, introduce only the minimum clean boundaries required by this feature. Avoid creating many tiny abstractions just for their own sake.

### EquipmentDropSystem responsibilities

- enemy eligibility;
- tier drop chance;
- area multiplier;
- effective area pool resolution;
- rarity filtering/normalization;
- item selection;
- quantity;
- emitting the result.

It must not manipulate DOM or Three.js objects.

### EquipmentSystem responsibilities

- owned item lookup;
- applying copies;
- level cap / banked copies;
- calculated weapon damage;
- Ascend;
- equip / unequip rules;
- hand attack profile generation.

It must not own the animation frame loop.

## Balance data additions

Add the global mechanic values to `balance.json`, conceptually:

```json
{
  "hero": {
    "bareHandDamage": 3,
    "bareHandCooldownSeconds": 1
  },
  "equipmentDrops": {
    "areaChanceGrowth": 0.15,
    "areaChanceMultiplierCap": 3,
    "baseChanceByEnemyTier": {
      "uncommon": 0.01,
      "rare": 0.02,
      "epic": 0.04,
      "legendary": 0.08
    },
    "rarityWeightsByEnemyTier": {
      "uncommon": { "common": 0.7, "uncommon": 0.3 },
      "rare": { "common": 0.4, "uncommon": 0.4, "rare": 0.2 },
      "epic": { "common": 0.2, "uncommon": 0.3, "rare": 0.3, "epic": 0.2 },
      "legendary": { "common": 0.1, "uncommon": 0.15, "rare": 0.2, "epic": 0.25, "legendary": 0.3 }
    }
  },
  "equipmentProgression": {
    "ascendLevel": 50,
    "ascendBaseMultiplier": 2
  }
}
```

Exact JSON organization can follow the loader conventions already in the project; avoid duplicate sources of truth.

## Save schema migration

The current save schema is version 7 and currently rejects a different version instead of migrating it.

This feature needs a save-schema bump, likely to version 8.

Do not wipe existing progression merely because equipment is added.

Add an explicit v7 -> v8 migration that preserves:

- daily state;
- current area;
- unlocked areas;
- defeated bosses;
- permanent stats;
- spawn state;
- existing inventory entries if any.

Initialize new equipment progression safely.

The inventory state should become conceptually:

```ts
inventory: {
  items: Record<string, OwnedEquipment>;
  equipped: {
    hand1: string | null;
    hand2: string | null;
    orbit1: string | null;
    orbit2: string | null;
  };
}
```

A map keyed by stable item ID is preferable to scanning an array for every duplicate drop.

## Existing permanent Blunt progression

Do not silently add the hero's current permanent Blunt stat to equipped weapon damage.

Weapon hits use weapon damage only.

An empty hand uses the game's unarmed/bare-hand attack value and remains Blunt.

Because the current project already has permanent `attack.blunt` progression from kills, implementation must make its role explicit rather than accidentally applying it to Hammers, Swords, or Spears. The safest migration is to treat the existing value as unarmed/bare-hand progression unless a separate design change later reworks permanent offensive stat rewards.

The important invariant for this feature is:

```text
weapon hit damage != hero base damage + weapon damage
weapon hit damage = calculated weapon damage
```

## Implementation order

### Phase 1 — Data and types

1. Add `slash` and `piercing` damage types.
2. Add weapon rarity/class/equipment types.
3. Add the 15 starter equipment definitions.
4. Add area loot-table data.
5. Add drop/Ascend tuning to balance data.
6. Add load-time validation for duplicate IDs, invalid item IDs, invalid rarity/class combinations, and invalid loot-table inheritance.

### Phase 2 — Save migration and equipment progression

1. Bump save version.
2. Add v7 -> new-version migration.
3. Add owned equipment state.
4. Implement duplicate -> level behavior.
5. Implement Level 50 cap and banked copies.
6. Implement Ascend and recursive base-damage calculation.
7. Add equip/move/unequip behavior.

### Phase 3 — Equipment drops

1. Listen to or call from the enemy-defeat flow after the normal stat reward.
2. Exclude Crystal/Common.
3. Roll tier chance with area multiplier.
4. Resolve effective area pool.
5. Filter/normalize rarity weights.
6. Roll rarity.
7. Roll one item from the matching area/rarity pool.
8. Apply quantity 1.
9. Emit `equipmentDropped`.
10. Persist once after the complete defeat/drop transaction where practical.

### Phase 4 — Independent hand combat

1. Set bare hand to 3 Blunt / 1.0 s.
2. Replace global hero cooldown with Hand 1 + Hand 2 cooldowns.
3. Build attack profiles from each hand independently.
4. Empty hand -> bare-hand profile.
5. Equipped hand -> weapon profile.
6. Weapon hit uses only weapon damage.
7. Re-target between hand attacks when needed.
8. Keep existing auto-attack behavior and current attack range.

### Phase 5 — UI

1. Add large equipment-drop notification queue.
2. Render owned items in Inventory.
3. Add weapon detail panel.
4. Add Equip Hand 1 / Equip Hand 2 actions.
5. Add Level / Ascend display.
6. Add Ascend button and hidden-power placeholder.
7. Update the combat HUD so both hands are represented accurately.

### Phase 6 — Validation/testing

Add deterministic tests around pure equipment/drop functions where practical by passing an RNG function instead of directly calling `Math.random()` inside every rule.

Example signature:

```ts
rollEquipmentDrop(context, rng = Math.random)
```

This has no meaningful runtime cost and makes boundary cases testable.

## Acceptance criteria

The feature is complete when all of the following are true:

- Common enemies never drop equipment.
- Crystals never drop equipment.
- Uncommon enemies can only roll Common/Uncommon gear.
- Rare enemies can only roll Common/Uncommon/Rare gear.
- Epic enemies can only roll up through Epic.
- Legendary enemies can roll all five rarities.
- Area 1 cannot select equipment absent from Area 1's loot table.
- Later-area equipment cannot leak into earlier areas.
- Drop frequency scales upward with area using the configured multiplier.
- A successful drop chooses only from items of the rolled rarity in the current area pool.
- First acquisition creates Level 1 / Ascend 0.
- Duplicate drops add levels.
- Level caps at 50 until Ascend.
- Copies at the cap are not lost.
- Ascend increments the Ascend count and resets level progression.
- New Ascend base damage equals 2x the previous Ascend's Level 50 damage.
- Weapon attacks do not add hero bare-hand damage.
- Hand 1 and Hand 2 have independent cooldowns.
- Empty Hand + equipped Hand can attack independently.
- Hammer attacks are Blunt.
- Sword attacks are Slash.
- Spear attacks are Piercing.
- Bare hands are 3 Blunt at 1.0 s per empty hand.
- The same owned item cannot be equipped in both hands simultaneously.
- Looting equipment shows a large non-blocking popup with quantity and progression.
- Inventory exposes weapon detail, equip actions, Level, Ascend, damage, speed, and the hidden-power placeholder.
- Existing v7 saves migrate without losing permanent progression.

## Explicitly deferred

Do not expand this feature into the following yet:

- armor drops;
- randomized affixes;
- procedural item stats;
- elemental damage;
- resistances/weaknesses;
- Spear range bonus;
- unique boss loot;
- pity systems;
- automatic Ascend;
- special weapon powers themselves;
- Orbit-slot behavior;
- dual-wield combo animations.

The goal of V1 is a clean, scarce, area-gated equipment loop with durable progression and independent hands, not a full ARPG itemization system.
