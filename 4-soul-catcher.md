# Soul Catcher multi-layer progression

## Goal

Extend the existing Soul Catcher into a persistent 10-layer progression system.

The feature adds:

- one global Soul Catcher XP bar;
- XP earned from every Soul spent in any Soul Catcher layer;
- automatic unlocking of the next Soul Catcher layer when the XP threshold is reached;
- bottom tabs for Layers 1–10;
- Layer 2 with 30 authored nodes;
- placeholder handling for unlocked but unauthored future layers;
- Rare Soul drops;
- percentage damage bonuses;
- percentage damage resistance;
- Evasion;
- rarity-specific respawn and equipment-drop modifiers.

This document is the active implementation plan for Soul Catcher v2. Existing implemented v1 behavior should be preserved unless explicitly superseded below.

## Project rules

Follow `AGENTS.md`.

Implementation order remains:

1. authored data and pure rules;
2. persistent state and migration;
3. focused systems/commands;
4. typed events;
5. UI projection;
6. keep `Game.ts` limited to composition and ordering.

Do not place Soul Catcher balance calculations in UI code. Do not add Soul-Catcher-specific node-ID checks in unrelated systems when an authored typed effect can express the same rule.

## Terminology

A **Soul Catcher progression layer** is a complete 30-node tree selected through the bottom tabs.

The concentric radii used to draw nodes inside a tree are only visual rings. Do not call those visual rings progression layers in new code or documentation.

Layer 1 contains SC-01 through SC-30.
Layer 2 contains SC-31 through SC-60.
Future layers continue with globally unique IDs up to SC-300 for Layer 10.

Neighbor-based reveal remains local to each progression layer. Unlocking a progression layer makes its first node available; it does not reveal all 30 nodes.

## Global Soul Catcher XP

There is exactly one persistent Soul Catcher XP total.

Every Soul spent on any node in any unlocked layer adds XP according to the Soul rarity used for that purchase:

| Soul rarity | XP per Soul spent |
| --- | ---: |
| Common | 1 |
| Uncommon | 3 |
| Rare | 80 |
| Epic | 500 |
| Legendary | 2500 |

Example: purchasing a node for 50 Uncommon Souls spends 50 Souls and grants 150 Soul Catcher XP.

XP is granted from the actual purchase cost paid for that level. Refunds do not exist in this scope.

The XP bar always represents progress toward the next progression layer, regardless of which layer tab is currently being viewed.

## Layer XP thresholds

The design target is approximately 80% of the weighted maximum XP value of all purchases in the current layer.

For each authored layer:

1. calculate every level cost for every node;
2. convert those costs to XP using the rarity exchange table above;
3. sum the full-layer maximum XP value;
4. set the unlock target at approximately 80% of that value, rounded to a clean balance value when useful.

Layer 1 currently represents approximately 105,365 weighted XP when fully maxed, giving a Layer 1 -> 2 target of approximately **84,292 XP**.

Layer 2 should target roughly 3x the economic scale of Layer 1. Its final Layer 2 -> 3 threshold must be recalculated from the authored Layer 2 JSON rather than copied from a provisional estimate.

Layers 3–10 must exist in progression metadata even before their node content exists. Use a power/log-scale progression curve for placeholder thresholds so later layers grow strongly without simply multiplying the previous threshold by a fixed factor forever.

Placeholder thresholds are temporary balance data. When a real layer is authored, its 80%-of-weighted-content value becomes authoritative.

Layer 10 has no next unlock. Its XP presentation should show a terminal state such as `MAX LAYER` rather than an endlessly filling bar.

## Node cost scaling

The existing linear formula remains:

`cost(L) = base + perLevel * (L - 1)`

However, new Layer 2 nodes should generally use **perLevel equal to base** unless a node explicitly specifies another progression.

Therefore a node with base cost 900 costs:

- level 1: 900;
- level 2: 1800;
- level 3: 2700;
- level 4: 3600;
- etc.

This stronger scaling supersedes the earlier weak Layer 2 cost proposal.

Evasion therefore does not require a special cost schema. Its requested costs can be represented with the normal formula sufficiently closely by using a 4500 base and 4500 per-level cost:

- level 1: 4500 Uncommon;
- level 2: 9000 Uncommon;
- level 3: 13,500 Uncommon.

The earlier 12,500 level-3 idea is superseded by the standard stronger scaling rule.

The Uncommon respawn node is an intentional exception because its two exact levels are decided as 50 then 100 Uncommon; this is still representable as base 50 / perLevel 50.

## Persistence and migration

Bump the save version when implementation begins.

Extend Soul Catcher state with at least:

```ts
soulCatcher: {
  balances: Record<SoulType, number>;
  nodeLevels: Record<string, number>;
  unlockAnnouncementSeen: boolean;
  xp: number;
  highestUnlockedLayer: number;
}
```

Do not persist the currently selected UI tab unless there is a clear UX need discovered during implementation.

Migration requirements:

- preserve all existing Soul balances;
- preserve all existing SC-01..SC-30 node levels;
- retroactively calculate XP from all existing purchased Layer 1 levels using the exact historical/current node costs and Soul rarities;
- derive `highestUnlockedLayer` from migrated XP thresholds;
- existing players who already crossed the Layer 1 threshold should immediately have Layer 2 available;
- broaden node-ID normalization so future SC-100..SC-300 IDs are valid;
- never discard otherwise valid existing Soul Catcher progression.

`RESET SOUL CATCHER` must now reset:

- all Soul balances to 0;
- all Soul Catcher node levels to 0;
- Soul Catcher XP to 0;
- highest unlocked progression layer back to Layer 1;
- reveal state back to the initial Layer 1 node only.

It must continue to preserve Area 2/world unlock progression and must not replay the original Soul Catcher unlock announcement.

## Layer registry and authored data

Refactor Soul Catcher data into a 10-layer registry.

Expected authored structure:

- `src/data/soul-catcher/layer-01.json` — existing 30-node tree;
- `src/data/soul-catcher/layer-02.json` — new 30-node tree;
- Layers 3–10 represented by progression metadata even if they do not yet have node JSON.

Validation should enforce:

- exactly 30 nodes in each authored progression layer;
- globally unique node IDs;
- valid neighbor references;
- no accidental neighbor connection across progression layers;
- one node = one gameplay effect;
- supported Soul rarity and cost formula;
- valid max level;
- every authored effect has a typed implementation.

Remove any assumption that the entire Soul Catcher contains exactly 30 nodes globally.

## Layer 2 design

Layer 2 has exactly 30 nodes, SC-31 through SC-60.

Use the same general dreamcatcher presentation as Layer 1: one central entry node with branching paths and roughly 1–3 neighbors per node. The graph should support multiple meaningful directions rather than one mandatory linear route.

SC-31 should be the initial revealed node when Layer 2 unlocks.

### Required Layer 2 nodes

| ID | Working name | Max level | Cost | Effect |
| --- | --- | ---: | --- | --- |
| SC-31 | Rare Resonance | 1 | 50 Uncommon | Unlock Rare Soul drops, base 1 |
| SC-32 | Uncommon Pursuit | 2 | 50 Uncommon base, +50/level | Divide Uncommon enemy respawn time by 2 at L1 and by 4 at L2 |
| SC-33 | Uncommon Spoils | 1 | 100 Uncommon | If the equipment item rolled is Uncommon rarity, increase its dropped quantity by 1 |
| SC-34 | Blunt Mastery | 5 | 100 Uncommon base, +100/level | +1% Blunt damage per level |
| SC-35 | Slash Mastery | 5 | 100 Uncommon base, +100/level | +1% Slash damage per level |
| SC-36 | Piercing Mastery | 5 | 100 Uncommon base, +100/level | +1% Piercing damage per level |
| SC-37 | Veilstep | 3 | 4500 Uncommon base, +4500/level | +1% Evasion per level |
| SC-38 | Rare Harvest | 1 | 25 Rare | +1 Rare Soul per eligible Rare enemy |
| SC-39 | Common Overflow | 1 | 100 Rare | +2 Common Souls per eligible Common enemy |
| SC-40 | Uncommon Harvest I | 1 | 50 Uncommon | +1 Uncommon Soul per eligible Uncommon enemy |
| SC-41 | Uncommon Harvest II | 1 | 50 Rare | +1 Uncommon Soul per eligible Uncommon enemy |
| SC-42 | Blunt Resistance | 10 | 900 Common base, +900/level | +1% Blunt damage resistance per level |
| SC-43 | Slash Resistance | 10 | 900 Common base, +900/level | +1% Slash damage resistance per level |
| SC-44 | Piercing Resistance | 10 | 900 Common base, +900/level | +1% Piercing damage resistance per level |

The remaining 16 nodes should use existing stat families so this layer does not unnecessarily introduce more new systems. A recommended authored set is:

| ID | Working name | Max level | Suggested cost | Effect |
| --- | --- | ---: | --- | --- |
| SC-45 | Greater Vitality I | 5 | 500 Common base, +500/level | +500 Max HP/level |
| SC-46 | Greater Vitality II | 5 | 900 Common base, +900/level | +1000 Max HP/level |
| SC-47 | Uncommon Vitality | 5 | 100 Uncommon base, +100/level | +1500 Max HP/level |
| SC-48 | Mending Weave I | 5 | 450 Common base, +450/level | +1 HP/s/level |
| SC-49 | Mending Weave II | 5 | 750 Common base, +750/level | +2 HP/s/level |
| SC-50 | Uncommon Regeneration | 5 | 75 Uncommon base, +75/level | +3 HP/s/level |
| SC-51 | Soulstep II | 5 | 450 Common base, +450/level | +10 Speed raw/level |
| SC-52 | Critical Focus II | 5 | 600 Common base, +600/level | +15 Critical Chance raw/level |
| SC-53 | Critical Imprint II | 5 | 700 Common base, +700/level | +25 Critical Damage raw/level |
| SC-54 | Guarded Soul | 5 | 800 Common base, +800/level | +5 Block Chance raw/level |
| SC-55 | Blunt Force | 10 | 450 Common base, +450/level | +12 Blunt attack/level |
| SC-56 | Slash Force | 10 | 450 Common base, +450/level | +12 Slash attack/level |
| SC-57 | Piercing Force | 10 | 450 Common base, +450/level | +12 Piercing attack/level |
| SC-58 | Blunt Bulwark | 10 | 500 Common base, +500/level | +10 Blunt flat defence/level |
| SC-59 | Slash Bulwark | 10 | 500 Common base, +500/level | +10 Slash flat defence/level |
| SC-60 | Piercing Bulwark | 10 | 500 Common base, +500/level | +10 Piercing flat defence/level |

These 16 nodes are balance defaults, not permission to change the 14 required mechanics above. If balancing during authoring requires modest adjustment, keep the overall Layer 2 weighted cost around 3x Layer 1 and then recalculate the Layer 2 XP threshold from the final JSON.

## Rare Soul unlock and yield

Replace hard-coded rarity eligibility checks with effect-driven rules.

`unlockSoulDrop` must work for Uncommon, Rare, Epic and Legendary Soul types without requiring special node IDs.

SC-31 unlocks Rare Soul drops with base quantity 1.
SC-38 adds +1 to Rare Soul drops.

All Soul-yield effects remain rarity-specific.

## Percentage outgoing damage

SC-34, SC-35 and SC-36 add +1% outgoing damage per level for one explicit damage type.

Represent these as source-aware multiplicative attack contributions rather than converting them into flat attack values.

At level 5, the corresponding Soul Catcher contribution is +5% for that damage type only.

Do not create an all-damage wildcard node/effect.

## Percentage damage resistance

Add a new source-aware percentage resistance stat for each explicit incoming damage type:

- Blunt resistance %;
- Slash resistance %;
- Piercing resistance %.

This is separate from the existing flat defence stat.

The decided incoming damage order is:

1. Evasion check;
2. percentage damage resistance;
3. existing flat defence;
4. Block handling;
5. apply remaining damage to HP.

Example:

- incoming hit = 100;
- matching damage resistance = 10%;
- after percentage resistance = 90;
- matching flat defence = 40;
- remaining damage before Block = 50.

Percentage resistance therefore applies **before** flat defence.

Clamp results so no stage produces negative damage.

Stats UI must show percentage resistance separately from flat defence and preserve source breakdowns.

## Evasion

Add a new persistent source-aware hero stat: Evasion.

SC-37 grants +1 percentage point of Evasion per level, maximum 3 levels.

Evasion is a chance to completely avoid an enemy attack. If Evasion succeeds:

- the attack deals 0 damage;
- percentage resistance is not evaluated for that attack;
- flat defence is not evaluated;
- Block is not rolled;
- combat presentation should clearly communicate an evade rather than a zero-damage hit.

Evasion must use a deterministic/testable chance helper in the combat domain/system rather than `Math.random` embedded in UI/Game presentation logic.

### Parallel-work warning

**Evasion may be implemented in parallel by another task/agent. Before implementing Evasion in this Soul Catcher work, inspect the current branch/main for an existing Evasion stat, icon, combat roll, save migration, Stats UI entry, or related commit. Reuse and integrate that implementation if it already exists. Do not implement Evasion twice.**

This check must happen immediately before the Evasion implementation slice, not only when this plan is first read, because parallel work may land after this document is created.

## Uncommon enemy respawn modifier

SC-32 modifies only Uncommon enemy respawn durations.

- level 0: normal authored respawn timing;
- level 1: calculated Uncommon respawn duration / 2;
- level 2: calculated Uncommon respawn duration / 4.

Apply the modifier in the renderer-independent respawn calculation/system.

Do not mutate the global authored Uncommon tier multiplier and do not affect Common, Rare, Epic, Legendary, Crystal, daily reset, or already-expired timers incorrectly.

The modifier should apply when a new respawn deadline is created. Existing persisted deadlines do not need to be retroactively rewritten unless implementation shows a strong reason to do so.

## Uncommon equipment quantity modifier

SC-33 is based on the **rarity of the equipment item that was successfully rolled**, not the enemy tier.

Normal flow:

1. roll whether an equipment drop occurs;
2. roll/select the equipment item using the existing loot table;
3. inspect the resulting equipment definition rarity;
4. if the rolled equipment rarity is `uncommon` and SC-33 is purchased, quantity becomes 2 instead of 1;
5. apply both copies to owned equipment progression;
6. emit/present the correct quantity.

This modifier must not double Common, Rare, Epic or Legendary equipment.

Keep the equipment-roll probability and rarity weighting unchanged.

## UI

Keep HTML/CSS for the Soul Catcher interface.

Inside the existing Soul Catcher panel, organize the major regions as:

1. Soul balances;
2. global XP bar;
3. current layer tree or placeholder content;
4. selected-node detail;
5. bottom Layer 1–10 tabs.

### XP bar

The bar should display current progress and the threshold toward the next progression layer.

Purchasing a node must refresh the XP bar immediately.

When a purchase crosses a threshold:

- unlock the next layer immediately;
- update the tabs;
- provide a concise progression presentation/toast;
- do not automatically spend or alter Souls beyond the node purchase itself.

If one purchase ever crosses more than one threshold, unlock all thresholds crossed deterministically.

### Layer tabs

Show all 10 progression layers at the bottom.

On the minimum 390px portrait viewport, use a horizontally scrollable compact tab strip if necessary rather than shrinking touch targets below project requirements.

States:

- unlocked + authored: selectable;
- unlocked + unauthored: selectable and shows placeholder;
- locked: visible but disabled/locked;
- current: visually selected.

When an unlocked layer has no authored nodes, replace the tree/node-detail region with exactly:

`Feature is coming soon!`

Do not fabricate placeholder nodes.

## Stats UI

Extend Stats to expose:

- Evasion %;
- Blunt resistance %;
- Slash resistance %;
- Piercing resistance %;
- Rare Soul drop base/unlock and Soul Catcher additions;
- existing Soul drop values derived from the Soul Catcher effect model rather than hard-coded node IDs.

Keep flat defence and percentage resistance as separate rows/concepts.

## Typed effects

Prefer explicit effect types similar to:

```ts
{ type: 'attackPercentAdditive'; damageType: DamageType; amountPerLevel: number }
{ type: 'damageResistancePercentAdditive'; damageType: DamageType; amountPerLevel: number }
{ type: 'evasionPercentAdditive'; amountPerLevel: number }
{ type: 'enemyRespawnDivisor'; tier: 'uncommon'; divisorPerLevel: number }
{ type: 'equipmentQuantityAdditive'; equipmentRarity: 'uncommon'; amountPerLevel: number }
```

Exact names may follow the existing domain naming conventions, but keep each effect explicit, typed and data-driven.

Do not implement SC-31/32/33/37 behavior by checking those node IDs from `Game.ts`, `ProgressionSystem`, `RespawnSystem`, or equipment code.

## Typed events

Add/extend events only where cross-system presentation needs them. Likely candidates:

```ts
soulCatcherXpGained: { amount: number; total: number }
soulCatcherLayerUnlocked: { layer: number }
heroEvaded: { damageType: CombatAffinity }
```

Do not emit redundant events if an existing event already carries all required information.

## Implementation slices

### Slice 1 — multi-layer domain and data registry

- clarify progression-layer terminology in new types;
- support 10 progression-layer metadata entries;
- keep Layer 1 data intact;
- add Layer 2 data shape support;
- change validation from 30 nodes globally to 30 nodes per authored progression layer;
- allow globally unique SC-01..SC-300 IDs;
- ensure graph edges stay within their progression layer;
- add XP rarity conversion and threshold pure rules;
- add placeholder power/log-scale threshold data for unauthored layers.

### Slice 2 — persistence and migration

- bump save version/storage key;
- add XP and highest unlocked layer;
- migrate current Soul Catcher data without loss;
- retroactively calculate XP from purchased Layer 1 levels;
- derive unlocked layer from XP;
- update reset behavior to clear XP and relock Layers 2–10.

### Slice 3 — SoulCatcherSystem progression

- grant XP atomically on every node purchase based on exact Soul cost spent;
- unlock all crossed layer thresholds;
- expose current XP/next threshold/current maximum layer to UI;
- make Soul rarity unlock/yield effect-driven instead of SC-20-specific;
- keep node reveal/purchase validation scoped to the selected authored layer;
- add typed progression events as required.

### Slice 4 — percentage combat stats

- add typed per-damage-type percentage resistance sources;
- add typed percentage outgoing attack effects;
- implement decided incoming order: Evasion -> percentage resistance -> flat defence -> Block -> HP;
- add Stats projection and source breakdowns.

### Slice 5 — Evasion integration

**Before coding, check main/current branch and recent relevant work for an Evasion implementation because Evasion may be implemented in parallel. Reuse it if present; do not duplicate stat fields, save migrations, icons, combat logic or Stats UI.**

If Evasion is not already implemented:

- add source-aware Evasion stat;
- add save migration/default;
- add deterministic chance resolution;
- integrate before resistance/defence/Block;
- add evade presentation;
- expose it in Stats.

Then connect SC-37 through the normal typed Soul Catcher effect projection.

### Slice 6 — respawn and equipment modifiers

- add Uncommon respawn divisor effect and integration;
- add rolled-equipment-rarity quantity effect;
- ensure an Uncommon equipment result gives quantity 2 and two copies of progression;
- keep loot chance and rarity weights unchanged.

### Slice 7 — author Layer 2

- create the 30 SC-31..SC-60 nodes according to the table above;
- use stronger `perLevel = base` scaling by default;
- author a branching dreamcatcher graph with 1–3 neighbors per node;
- make SC-31 the initial entry;
- place economy/Rare unlock, offensive %, resistance, Evasion and supporting existing-stat nodes into coherent branches;
- calculate exact full Layer 2 weighted XP cost after authoring;
- set Layer 2 -> 3 threshold to approximately 80% of that final value.

### Slice 8 — UI

- add global XP bar;
- add Layer 1–10 bottom tabs;
- switch tree data by selected progression layer;
- render locked/unlocked/current states;
- render `Feature is coming soon!` for unlocked unauthored layers;
- render MAX state for Layer 10;
- refresh XP/tabs/tree after purchases and resets.

### Slice 9 — validation

Validate at minimum:

- fresh save starts at Layer 1, 0 XP;
- existing save migration preserves Soul balances and node levels;
- migrated purchases receive the correct retroactive XP;
- every Common/Uncommon/Rare/Epic/Legendary Soul spent grants 1/3/80/500/2500 XP respectively;
- spending Souls in Layer 1 continues progressing the same global XP bar after Layer 2 unlocks;
- Layer 2 unlocks at the correct Layer 1 threshold;
- unlocked unauthored Layer 3 shows `Feature is coming soon!`;
- reset returns to Layer 1 / 0 XP and preserves world progression;
- SC-31 unlocks base Rare Soul drops;
- SC-38 adds exactly +1 Rare Soul;
- SC-39 adds exactly +2 Common Souls;
- SC-40 and SC-41 each add exactly +1 Uncommon Soul;
- Layer 2 normal node cost sequences follow base, 2x base, 3x base...;
- SC-32 produces /2 then /4 Uncommon respawn timing;
- SC-33 doubles quantity only when the rolled equipment rarity is Uncommon;
- percentage damage nodes affect only their matching outgoing damage type;
- resistance calculation example 100 hit -> 10% = 90 -> 40 flat defence = 50 before Block;
- each resistance type affects only matching incoming damage;
- Evasion completely avoids the hit before resistance/flat defence/Block;
- SC-37 reaches 1%, 2%, 3% Evasion at levels 1–3;
- no duplicate Evasion implementation exists after integration;
- tabs remain usable on iPhone 12 portrait 390x844;
- drag/pinch behavior of authored trees still works;
- `npm run build` passes;
- `npm run validate:release` passes when the complete implementation is ready.

## Acceptance criteria

- Soul Catcher supports 10 progression layers structurally.
- There is one persistent global XP value/bar shared by all layers.
- Any Soul spent anywhere grants XP using the decided rarity values.
- Layer 1 -> 2 threshold reflects approximately 80% of Layer 1 weighted maximum spending.
- Authored layer thresholds use approximately 80% of that layer's weighted maximum spending.
- Future unauthored thresholds follow the placeholder power/log-scale curve until replaced by authored balance.
- Layer 2 contains exactly 30 nodes.
- New Layer 2 multi-level costs generally scale base, 2x base, 3x base, etc.
- Rare Soul drops can be unlocked and increased.
- Uncommon respawn time can be divided by 2 then 4.
- Uncommon-rarity equipment rolls gain +1 quantity when the node is purchased.
- Per-damage-type +% outgoing damage nodes exist.
- Per-damage-type percentage resistance nodes exist and apply before flat defence.
- Evasion provides a full-hit avoidance chance before resistance, flat defence and Block.
- Evasion implementation is checked for parallel work before being added, and is never implemented twice.
- Common/Uncommon/Rare Soul-yield upgrades remain explicitly rarity-specific.
- Layer tabs appear at the bottom and support Layers 1–10.
- An unlocked but unauthored layer displays exactly `Feature is coming soon!`.
- Reset clears Souls, nodes, XP and extra layer unlocks while preserving existing world progression.
- Existing saves migrate without losing supported progression.
- Gameplay calculations remain outside UI code and `Game.ts` remains composition/presentation-oriented.
