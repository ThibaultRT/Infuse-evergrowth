# Autonomous minions

## Goal

Add persistent autonomous allies that fight and grow from their own kills, can be
sacrificed to infuse part of that growth into the hero, and can then be summoned
again at an escalating Soul cost.

This is a major gameplay feature, not a rendering-only companion. Kill ownership,
loot, equipment, death, respawn, sacrifice, and summon cost must remain authoritative
outside Three.js and the DOM.

## Recommended first release

Ship one active minion in Area 1 first, while making the save and UI collection-based
so a later upgrade can allow several differently colored minions. The first release
simulates minions only while the game is running; it does not add offline catch-up.
Cross-area autonomous travel and more than one simultaneous minion are follow-up
features because both require new navigation, simulation, and balance work.

The first release includes:

- the Soul Catcher unlock and a development-only instant-unlock command;
- one persistent Imp minion with a randomly selected, persisted color variant;
- autonomous Area 1 targeting, movement, combat, recovery, death, and respawn;
- private minion stats and equipment progression;
- Soul contribution tracking;
- the conditional Summoning Pit landmark and its world-space management button;
- the minion management panel, sacrifice confirmation, hero infusion, and paid
  re-summoning;
- a data model that supports a roster rather than a hard-coded singleton.

##  Soul Catcher decision

re-author the next connected post-resonance node (`SC-21`) as the one-level minion unlock, and set its cost to 30 Uncommon Souls.
Use a typed `unlockMinions` effect; do not check `SC-21` in gameplay code.

## Gameplay contract

### Unlock and summoning

- Purchasing the agreed Soul Catcher node transitions the feature from locked to
  unlocked and creates the first minion exactly once.
- The first minion is included in the node purchase; it does not also charge a
  summon fee.
- A minion begins at the shared Area 1 Summoning Pit spawn point beside the fountain.
- Its color is selected with the injected gameplay RNG and stored as a stable variant
  ID. Reloading never rerolls an existing minion.
- The data model owns a stable minion ID and a roster. Initial active capacity is one.
- After a sacrifice empties the roster, the player may summon one replacement. The
  first paid summon costs 30 Uncommon Souls; subsequent paid summons cost
  `30 * 10^paidSummonCount`. The initial node-granted minion is excluded from this
  counter. Put the base, multiplier, and active capacity in `balance.json`.
- Deduct Souls, create the minion, select its color, and persist in one command. A
  failed command changes nothing.

### Autonomy and targeting

Use a renderer-independent minion state machine:

1. `seeking` chooses the nearest reachable living enemy or crystal in Area 1;
2. `moving` follows a path built from authored walk surfaces and collision proxies;
3. `attacking` schedules its own held/orbit attacks independently of the hero;
4. `recovering` stops seeking after a kill when HP is below 30%;
5. `dead` waits for the persisted respawn deadline.

Target ties must be stable, using spawn ID after distance. Do not derive navigation
or collision from the Imp, Summoning Pit, or any loaded mesh. Add deterministic
Area 1 navigation over the existing renderer-neutral walk surfaces/collision. A
stuck detector may request a new path, but must not teleport the minion through
authored blockers.

While recovering, the minion stays in place and regenerates. It resumes seeking at
75% HP or above. A hostile enemy entering the normal aggro radius, or damaging the
minion, interrupts recovery so the minion can defend itself; after the threat is
gone it returns to recovery if still below 75%.

Enemy intent must accept a stable target reference rather than assuming the hero is
the only target. A hostile enemy chooses or retains a reachable hero/minion target,
and damage is applied to that actor. Hero death must not reset an enemy that is still
engaged with a living minion.

### Base stats and combat

- A new minion starts from the hero's authored base stat values, not the hero's
  current accumulated stats.
- Base maximum HP is twice the authored hero base maximum HP. Base movement speed,
  regeneration, critical, block, and evasion values use the hero bases.
- An unequipped Imp uses an innate Blunt attack equal to the authored hero base Blunt
  attack. Define its attack cooldown and range in minion balance data.
- Kill stat rewards are applied to the killing minion's own `kills` sources with the
  same stat curves and Max HP healing behavior used by the hero.
- Minion weapon slots schedule independently. An equipped weapon uses that weapon's
  damage plus the minion's persistent stat of the same damage type, with no extra
  innate-attack term.
- Minion outgoing affinity, critical hits, incoming resistance, flat defence,
  evasion, and block reuse the same pure combat order as the hero. Soul Catcher stat
  bonuses remain hero-only unless a later node explicitly targets minions.

### Kill ownership and rewards

Every lethal hit has exactly one owner: `hero` or a stable `minionId`. Split the
current defeat flow into global consequences and owner-specific rewards:

- enemy respawn state, daily kills, one-life reward roll consumption, boss defeat,
  and gate unlock are global and happen exactly once;
- the rolled stat reward and equipment drop go only to the lethal-hit owner;
- a minion kill must never also add the same stat/equipment reward to the hero;
- Soul eligibility and quantity still use the player's Soul Catcher effects;
- Souls from minion kills are credited immediately to the player's global Soul
  balances and are also counted in that minion's lifetime Soul-contribution summary;
  sacrifice does not award them a second time.

Crystals are valid non-hostile targets and grant their normal rolled stat reward.
They do not retaliate and do not yield Souls or equipment under the existing rules.

### Equipment autonomy

Each minion owns a separate `InventoryState`; minion drops never enter the hero's
inventory. Reuse equipment definitions, level/Ascend math, compatible slots, and
currently unlocked slot rules.

After applying every equipment drop:

1. keep the item equipped if that same item is already in a compatible slot;
2. otherwise fill the first free compatible unlocked slot (held weapon before orbit
   slots; the matching armor slot for armor);
3. when compatible slots are full, compare the candidate's standalone calculated
   damage/defence at its owned Level/Ascend against the weakest equipped candidate;
4. replace only on a strict improvement; ties keep the current equipment;
5. automatically apply available Ascends using the existing copy-consumption rule,
   then rerun the comparison.

The comparison excludes the minion's character stats, affinities, and target
weakness. It is therefore stable "raw equipment" value rather than simulated combat
damage. Keep unequipped drops in the minion's private inventory so later copies can
make them worth equipping.

### Death and respawn

- Lethal damage sets `respawnAt = now + 30 seconds`, removes the live/view entity,
  and preserves color, stats, Soul counters, and inventory.
- On the deadline, the minion returns at full health at the Summoning Pit and resumes
  seeking.
- Loading a save after the deadline revives it immediately at the pit. Loading before
  the deadline preserves the remaining wall-clock delay.
- There is no death penalty and death does not change the paid-summon counter.

### Sacrifice and hero infusion

`Sacrifice minions and infuse the hero` is enabled only when the roster is non-empty.
It opens the existing accessible confirmation dialog with explicit irreversible
copy. Confirmation performs one atomic command:

- sum every roster member's kill-earned stat sources;
- add exactly 50% of each eligible source to the corresponding hero source named
  `minions` (Max HP, regeneration, speed, evasion raw, typed attacks and souls);
- increase current hero HP by the transferred Max HP amount, capped at the new max,
  consistent with a normal Max HP reward;
- delete all roster members, including dead/respawning ones, and cancel their timers;
- consume their private equipment and transfer their levels to the hero's own equipments. to avoid miscalculation, if equipment was acended, all original copies must be refunded to transfer to the hero the total qty and not only the remaining qty after acends.;
- also add souls collected by the minion to the hero;
- persist once, then emit one aggregate infusion event for UI refresh/presentation.

Do not round fractional stat results; current stat sources support finite numbers.
Repeated confirmation or event delivery must not apply an infusion twice. The hero
Stats panel exposes `From minions` alongside existing source lines.

The Soul Catcher reset interaction must be decided : decision is to keep minion unlocked when soul catcher is reset, and have its node do nothing when it is re-purchased.

## Persistent model and migration

Bump the save version and storage key. Extend the save with a normalized collection,
not renderer/runtime objects:

```ts
type MinionColorVariant = 'variant-1' | 'variant-2' | 'variant-3';

type SavedMinion = {
  id: string;
  color: MinionColorVariant;
  hp: number;
  respawnAt: number | null;
  stats: PlayerStats;
  inventory: InventoryState;
  soulContributions: Record<SoulType, number>;
};

type MinionProgression = {
  nextSerial: number;
  initialSummonGranted: boolean;
  paidSummonCount: number;
  roster: SavedMinion[];
};
```

The exact color IDs must follow the verified Imp material/texture variants rather
than filenames guessed in gameplay code. Runtime position, path, target, animation,
cooldowns, and recovery mode are transient. In the Area 1 first release, an alive
minion reconstructs at the pit after a reload, matching the current policy that does
not persist the hero's exact world position.

Normalization must:

- accept every currently supported save version and create an empty minion state;
- preserve valid future roster entries by stable ID;
- discard unknown equipment IDs and incompatible equipped-slot entries without
  discarding the rest of the minion;
- clamp HP to normalized max HP and accept only finite, non-negative stat/currency
  values;
- enforce unique IDs and the current active-capacity limit;
- repair invalid color IDs with injected/default deterministic fallback data;
- revive expired respawn deadlines on session creation;
- add `minions` to hero additive sources and to raw Evasion source normalization.

Feature availability is derived from the typed Soul Catcher effect; do not persist a
second unlocked boolean.

## Module boundaries

### Data and domain

- Add minion tuning under `src/data/balance.json`: capacity, health multiplier,
  attack range/cooldown, recovery thresholds, respawn seconds, base summon cost, and
  summon multiplier.
- Add the typed `unlockMinions` Soul effect to the agreed Layer 1 node.
- Add pure summon-cost, minion-initialization, recovery-threshold, auto-equip, and
  infusion calculations under `src/domain/`.
- Generalize hero-only stat helpers only as far as needed for a plain actor stats +
  inventory input. Do not introduce a generic ECS.
- Add a stable `CombatActorRef`/defeat-owner value so combat and rewards never depend
  on meshes or object identity.

### Systems and runtime

- `MinionSystem` owns roster lifecycle, reward application, auto-equipment, sacrifice,
  paid summoning, and persistence-facing operations.
- `MinionAISystem` owns seek/move/attack/recover/dead intent using plain runtime data.
- `GameplayRuntime` owns live minion positions, HP, movement, targets, and Area 1
  collision/path following.
- Refactor `ProgressionSystem.defeat` so global defeat consequences and owner reward
  delivery are explicit and cannot double-run.
- Extend enemy AI to target an actor reference and emit actor-targeted attack events.
- `GameSession` composes and orders the systems, injects clock/RNG, and projects
  snapshots. `Game.ts` remains presentation/composition only.

### Commands and events

Add commands equivalent to:

```ts
{ type: 'summonMinion' }
{ type: 'sacrificeMinions' }
{ type: 'debugUnlockMinions' }
```

The debug command is idempotent, available only behind `import.meta.env.DEV`, spends
no Souls or Soul Catcher XP, and enters through the same typed unlock/synchronization
path that creates the first minion. The production UI must not render its button.

Add only presentation-relevant typed events, carrying stable IDs and aggregate plain
values, for example:

- `minionsUnlocked`;
- `minionSummoned`;
- `minionDamaged` / `minionDefeated` / `minionRespawned`;
- `minionEquipmentChanged`;
- `minionProgressed`;
- `minionsInfused`.

Owner-aware damage/defeat events should supersede ambiguous hero/enemy-only payloads
where necessary. Do not emit one event per transferred stat during sacrifice.

## Rendering, assets, and world placement

The supplied sources exist at:

- `authoring/local/assets/Bestiary - Dungeon Monsters Kit[Standard]/Exports/GLB
  (Godot-Unreal)/Imp.glb`;
- `authoring/local/assets/models/Summonning_pit.glb` (source spelling).

The raw Imp GLB is about 9.4 MB, so it must not be copied directly into production.
Before integration, inspect its dimensions, pivot, forward axis, skeleton, animation
clips, materials, and the three supplied base-color variants. Create a repeatable
preparation/optimization script that emits one browser-ready GLB where practical,
with animation names mapped to idle, move, attack, hit, and death. Preserve a simple
playable fallback if loading or a cosmetic clip fails.

Add Quaternius/QAL provenance to `ASSET-LICENSES.md`; do not ship the source pack or
unneeded variants. Normalize both accepted assets through the existing authoring
pipeline and reference stable runtime asset keys.

Author one renderer-neutral Summoning Pit placement/spawn definition beside the
Area 1 fountain. Rendering, minion spawn/respawn, and the projected management button
must consume that shared transform. Select the exact position, rotation, fit, and
clearance in the authoring viewer; do not guess a collision footprint from the GLB.
Prefer no pit collision in the first release unless a deliberate semantic proxy is
authored and its locked/unlocked activation is supported.

The pit and Imp assets lazy-load only after the feature is unlocked. `MinionView`
projects runtime state and reuses shared geometry/material/animation resources where
safe. It owns no gameplay state. The management button is a DOM world label with a
minimum 44 px touch target, `pointer-events: auto`, and visibility tied to the pit's
life, Area 1 residency, camera projection, and unlock state.

## Minion management UI

Add a DOM modal/sheet opened only from the button above the Summoning Pit. It does not
pause simulation.

For each roster member, show a compact icon-and-number grid with accessible labels:

- current/max HP, regeneration, speed, evasion, and each non-zero attack/defence;
- equipped item icons and their Level/Ascend progression number;
- Common through Legendary Soul contribution icons and totals;
- dead/respawning state and remaining time when applicable.

The layout must naturally render several minion cards later even though capacity is
one now. Keep names and long explanations out of the summary; use `aria-label` or
visually hidden text so icon-only values remain understandable.

At the bottom:

- show `Sacrifice minions and infuse the hero` while a roster exists;
- after sacrifice, disable it 
- show a `Summon minion` button at the top right corner with its current Uncommon Soul cost;
- disable summoning with a concise affordability reason when Souls are insufficient;
- refresh from a detached read-only progression snapshot on panel open and coalesced
  minion/progression events, never every frame.

## Implementation slices

### 1. Resolve progression placement and lock balance

- Lock first-release scope to one Area 1 minion and active-session simulation.
- Add minion tuning and the typed Soul Catcher effect; recalculate affected Layer 1
  weighted XP metadata if node cost/content changes.

### 2. Pure rules and save migration

- Add minion/save types, factories, normalization, and the new save version/key.
- Add pure summon-cost, auto-equip, sacrifice-transfer, target-tie, and recovery rules.
- Add the hero `minions` stat source without changing totals for migrated saves.

### 3. Owner-aware defeat and progression

- Introduce stable combat actor/kill ownership.
- Split global defeat state from hero/minion reward destinations.
- Route stats, equipment, Souls, boss/gate consequences, and persistence exactly once.
- Keep the persisted per-life spawn roll authoritative regardless of killer.

### 4. Minion runtime, navigation, and combat

- Add Area 1 pathing from semantic collision/walk data and deterministic stuck recovery.
- Add minion state transitions, regeneration, independent cooldowns, and attacks.
- Extend enemy targeting/damage to minions and persist the 30-second respawn deadline.
- Verify hero/minion simultaneous attacks cannot double-defeat a spawn.

### 5. Autonomous equipment

- Reuse actor stats/inventory combat projections.
- Apply drops, automatic Ascend, free-slot selection, strict raw-value replacement,
  armour defence, and held/orbit scheduling.
- Add detached minion summary projection for the UI.

### 6. Asset preparation and world presentation

- Audit and normalize the supplied Imp and pit sources with repeatable scripts.
- Add runtime asset keys, license entry, fallbacks, and unlock-gated lazy loading.
- Author/capture the shared pit placement and add minion/pit views plus projected button.

### 7. Commands and management UI

- Add the development-only unlock button and authoritative command.
- Add management cards, live death countdown, sacrifice confirmation, infusion event,
  and paid summon state.
- Add `From minions` to every relevant hero Stats breakdown.

### 8. Validation and release handoff

- Run focused deterministic validation first, then `npm run build` and the affected
  world/asset validators.
- Capture the pit, Imp combat, and management UI at the 390 x 844 CSS viewport in
  Full and Reduced modes.
- Run `npm run validate:release` only when the complete slice is ready for acceptance.
- Bump the package minor version for the shipped gameplay/assets and commit on the
  current branch after reviewing the final diff/status.

## Deterministic validation matrix

Cover at least:

- unlock migration, idempotent initial spawn, persisted color, and dev unlock without
  Soul/XP changes;
- summon costs 30, 300, 3000 and atomic insufficient-funds failure;
- nearest reachable target selection, stable ties, crystal targeting, blocker routing,
  and recovery transitions at just below/at 30% and 75%;
- enemy targeting of hero versus minion and defensive wake while recovering;
- simultaneous hero/minion lethal attempts with one defeat, one respawn deadline,
  and one reward owner;
- minion-owned stat/equipment drops, global Soul credit with per-minion attribution,
  and boss/gate consequences;
- empty-slot auto-equip, strict replacement, tie retention, later-level improvement,
  automatic Ascend, and typed armour defence;
- death/reload before and after the 30-second deadline;
- sacrifice of alive and respawning roster members, exact 50% transfer, one persist,
  no duplicated Souls/equipment, and no replay on reload;
- Soul Catcher reset behavior selected in Slice 1;
- corrupt/partial minion saves normalizing without loss of supported hero/world data.

Do not use AI-controlled live gameplay as acceptance evidence. Give the user a short
manual checklist for minion readability, movement around obstacles, combat feel,
sacrifice clarity, reload behavior, and real-device performance.

## Acceptance criteria

- The agreed Soul node and the development-only button each unlock the same feature
  path without duplicate free minions.
- A persisted Imp autonomously clears reachable Area 1 targets, grows only from its
  own kills, equips upgrades, retreats to recover, defends itself, and respawns at
  the pit 30 seconds after death.
- One kill produces one owner-specific reward and one set of global world consequences.
- The management page accurately summarizes stats, equipment, Soul contributions,
  death state, sacrifice value, and next summon cost using icons plus accessible text.
- Sacrifice atomically removes the roster and adds exactly half its kill-earned stats
  to the hero's visible `From minions` sources.
- Paid re-summoning uses the persisted exponential cost and cannot be bypassed by
  reload, repeated clicks, or the chosen Soul Catcher reset policy.
- Pit/minion model failure leaves gameplay and management usable; mobile UI and
  payload/performance budgets remain within project rules.

## Explicit follow-ups

- simultaneous roster capacity above one and its unlock/balance source;
- autonomous cross-area routing and offscreen simulation;
- offline catch-up;
- manual minion orders, naming, equipment management, or equipment transfer;
- new minion species or generated art.
