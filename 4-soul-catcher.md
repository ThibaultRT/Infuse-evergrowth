# Soul Catcher progression

## Goal

Add a persistent Soul Catcher upgrade path unlocked by defeating the Area 2 boss. Eligible defeated enemies provide rarity-matched Souls that can be spent in a 30-node radial tree.

The editable node definitions are the balance source of truth:

- `WIP/soul-catcher/nodes/layer-01.json` — all 30 nodes in the first Soul Catcher layer

All current nodes form the first Soul Catcher layer. Later expansions may add new layers, but no additional layers are defined yet. The active aggregate is `src/data/soul-catcher/layer-01.json`.

## Unlock and drops — decided

- Soul Catcher is visible from game start but greyed/barred until the Area 2 boss is defeated.
- If an existing save already defeated the Area 2 boss before this feature ships, Soul Catcher unlocks immediately on migration and its announcement is shown once.
- Tapping the locked button shows the exact toast: `Defeat area 2 boss to unlock Soul Catcher`.
- On first unlock, show `Soul Catcher unlocked!` and `Infuse souls of the defeated enemies and unlock powerful upgrades!` **immediately after** the normal boss/route presentation.
- Initially only Common enemies drop Souls.
- Base eligible drop = 1 Soul per enemy.
- Crystals never display or drop Souls.
- Locked enemy rarities display no Soul reward above the enemy HP bar.
- Uncommon Soul drops are unlocked by SC-20 `Uncommon Resonance`, roughly two-thirds through the 30-node progression.
- SC-20 costs **250 Common Souls** and unlocks base **1 Uncommon Soul per Uncommon enemy**.
- Rare/Epic/Legendary Soul unlocks remain future work.
- Soul quantity is shown above enemy HP bars and on defeat as quantity + icon, slightly below the existing stat reward popup.
- Add Soul Drops to the Stats panel, including Base 1 and upgrade contributions.
- **Hero death never removes unspent Souls and never removes purchased Soul Catcher node levels.**
- Soul-yield bonuses are **rarity-specific**. A Common Soul yield node affects only Common Souls, an Uncommon yield node affects only Uncommon Souls, and future Rare/Epic/Legendary yield nodes follow the same rule. Do not add generic `+1 to every eligible Soul rarity` effects.

## Canonical icons

Use the committed assets; do not regenerate substitutes during implementation:

- `public/icons/soul-skull.svg` — selected V5 flaming skull; canonical Soul currency icon.
- `public/icons/soul-catcher.svg` — Soul Catcher HUD icon.
- `public/icons/inventory-bag.svg` — Inventory HUD icon.

Use one `soul-skull.svg` silhouette for all rarities and tint it via CSS/SVG mask:

| Soul | Color |
| --- | --- |
| Common | `#b8bec8` |
| Uncommon | `#64dc8c` |
| Rare | `#5d98ff` |
| Epic | `#bf75ff` |
| Legendary | `#ffb33d` |

Recommended sizes: 11–14 px in enemy reward labels, 16–20 px in reward popups/stats, 22–28 px in the Soul balance banner.

## Approved right-edge HUD

The approved portrait mockup is the layout reference.

- Keep `STATS` where it is.
- Keep `SPAWN` where it is below Stats.
- Narrow the large HP/combat banner enough to move the Settings wheel into a compact square immediately to the banner's right and Stats' left.
- Add Soul Catcher farther down the open right edge.
- Add Bag / Inventory directly below Soul Catcher.
- Keep a clear gap between Spawn and Soul Catcher so they read as separate groups.
- Soul Catcher is barred/desaturated while locked; Bag is always available.
- Remove the bottom text `INVENTORY` button and contract the dock around H1/H2/O1/O2.
- Target ~48 px touch areas, never below 44 px; respect safe areas.
- Validate at iPhone 12 portrait and modern iPhone portrait sizes without overlap.

The older reward-popup/icon-placement questions are obsolete; use the latest approved HUD revision as the visual reference.

## Soul balance banner — decided

The sticky top banner inside Soul Catcher always shows **all five Soul rarities**:

- Common
- Uncommon
- Rare
- Epic
- Legendary

Do not grey or hide locked currencies. Their normal rarity-colored icon remains visible and their quantity simply reads `0` until that Soul type becomes obtainable.

## Skill tree interaction — decided

Use DOM + SVG/CSS, independent from Three.js.

### Visual layout

- Layer 1: 1 core node.
- Layer 2: 6 inner nodes.
- Layer 3: 10 middle nodes.
- Layer 4: 13 outer nodes.
- The layer number/radius describes **where a node is drawn and which JSON file owns it**, not when it becomes available.
- JSON owns node number, ID, description, polar position, max level, cost Soul type, base cost, cost scaling, reward and graph connections.

### Neighbor-based progression

There is no separate layer-by-layer unlock rule.

- SC-01 is the only node whose details are available initially.
- Each node should have approximately **1–3 neighboring nodes** connected to it in the authored graph.
- Purchasing the **first level** of a node immediately reveals **all of that node's neighboring nodes**.
- A multi-level node does **not** need to be maxed before progression can continue.
- Once revealed, a neighboring node can be selected regardless of which visual ring/layer contains it.
- Connections may therefore branch sideways or outward as needed to create a natural dreamcatcher graph rather than strict concentric progression.
- Author node connections explicitly in JSON; the renderer should derive connection lines and reveal behavior from the same graph data.

Preferred authored representation:

```json
{
  "id": "SC-08",
  "neighbors": ["SC-12", "SC-18"]
}
```

The implementation must validate references and keep graph connections visually symmetric even if the JSON stores each edge only once.

### Mystery nodes

Unrevealed connected nodes are visible as **mystery nodes** so the player can see that further progression exists.

- Show the node silhouette/slot and its connection line.
- Do not reveal its name, level count, cost, reward, Soul type or description.
- Mystery nodes are **not clickable/selectable** and cannot open a detail panel.
- When one of their connected purchased nodes reaches level 1, transition them to the normal revealed state.

### Purchase UX

- Tap a **revealed** node to open its detail card.
- The detail card contains name, description, current level/max, next-level cost, reward and an explicit `Purchase` button.
- Tapping the node itself never spends Souls.
- Purchases are **one level at a time only**. Do not add Buy Max for this version.
- Purchasing level 1 both applies that node's first reward and reveals all neighboring mystery nodes.
- One-finger drag pans the tree.
- Pinch zoom is supported.
- Minimum node hit target: 44 px.

Cost formula for target level `L`:

`cost(L) = base + perLevel × (L - 1)`

## Balance rules — revised

1. **One node = one stat/effect.** No node may grant multiple hero stats. Effects such as `allAttackAdditive` are also avoided because they modify multiple attack stats at once.
2. Early costs remain low and progressive. SC-02 remains the reference example: 25 Common Souls initially, +25 cost per level, +50 Max HP per level, max 10.
3. High-end Common Soul base costs are softened: late nodes that were around 400–500 now target **250–300 Common Souls** for their first level. SC-26/28/29/30 are capped at 300 base in the current draft.
4. SC-20 `Uncommon Resonance` is the transition milestone at approximately **20/30 nodes (two-thirds progression)** and costs **250 Common Souls**.
5. Exactly five nodes in this first tree spend Uncommon Souls: **SC-21 through SC-25**. Their entry costs intentionally remain low so the newly unlocked currency is immediately useful.
6. Defence is a first-class Soul Catcher reward. Defence is typed independently as `blunt`, `slash`, or `piercing`.
7. Defence nodes use **+5 defence per purchased level**, with up to **10 levels**, therefore +5 at level 1 through +50 total at level 10.
8. Soul-yield effects are always rarity-specific; each authored `soulDropAdditive` includes one explicit `soulType`.

### Uncommon branch

| Node | Cost | Max | Single reward |
| --- | ---: | ---: | --- |
| SC-20 Uncommon Resonance | 250 Common | 1 | Unlock Uncommon Soul drops, base 1 |
| SC-21 Uncommon Blunt Ward | 5 Uncommon, +5/level | 10 | +5 Blunt defence/level |
| SC-22 Uncommon Slash Ward | 5 Uncommon, +5/level | 10 | +5 Slash defence/level |
| SC-23 Uncommon Piercing Ward | 5 Uncommon, +5/level | 10 | +5 Piercing defence/level |
| SC-24 Uncommon Harvest | 10 Uncommon, +10/level | 3 | +1 Uncommon Soul/enemy/level |
| SC-25 Uncommon Vitality | 15 Uncommon, +10/level | 5 | +200 Max HP/level |

SC-20 must be graph-connected so that purchasing it reveals SC-21..SC-25 through the normal neighbor system. Because each node should generally expose only 1–3 neighbors, the five Uncommon-spending nodes do **not** all need to connect directly to SC-20; they can form a short branching cluster beginning at SC-20 while still becoming available quickly after Uncommon Resonance.

### Defence effect schema

The authored draft uses:

```json
{
  "type": "defenceAdditive",
  "damageType": "piercing",
  "amountPerLevel": 5
}
```

Codex should map this to the game's typed defence-stat implementation during integration. Keep Blunt, Slash and Piercing defence independently source-aware so Soul Catcher contributions can be shown in Stats.

### Soul-yield effect schema

Every Soul-yield upgrade must target one rarity explicitly:

```json
{
  "type": "soulDropAdditive",
  "soulType": "uncommon",
  "amountPerLevel": 1
}
```

Do not introduce an `all`, `eligible`, wildcard, or cross-rarity Soul yield type.

## Persistence and reset — decided

Add to the next save version:

```ts
soulCatcher: {
  balances: {
    common: number;
    uncommon: number;
    rare: number;
    epic: number;
    legendary: number;
  };
  nodeLevels: Record<string, number>;
  unlockAnnouncementSeen: boolean;
}
```

Derive Soul Catcher availability from existing Area 2 boss progression rather than duplicating an unlock boolean. Existing saves that already defeated the Area 2 boss unlock immediately with zero Souls and show the announcement once.

Hero death leaves the entire `soulCatcher` state unchanged: balances, node levels, reveal state and announcement state all persist normally.

Add a dedicated developer/settings action named exactly:

`RESET SOUL CATCHER`

Its behavior:

- reset every Soul balance to `0`;
- reset every purchased node level to `0`;
- preserve Area 2 boss progression, therefore Soul Catcher remains unlocked if the boss was already defeated;
- restore the tree to its initial state with only SC-01 revealed/actionable and all other nodes back to mystery state;
- do not replay the Soul Catcher unlock announcement;
- do not alter equipment, ordinary permanent stats from other systems, defeated bosses, gates or area progression.

This reset is a **developer-purpose control**. Reuse the same simple confirmation interaction already used by the existing reset controls; do not add a stronger or bespoke warning modal just for Soul Catcher.

## Architecture

Add a focused `SoulCatcherSystem` under `src/systems/`; do not put progression rules in `Game.ts` or UI code.

Responsibilities:

- availability from world progression;
- rarity eligibility;
- rarity-specific Soul yield calculation and grant;
- balances and spending;
- neighbor-based node reveal/purchase validation;
- Soul Catcher reset;
- node effect projection into source-aware hero/Soul stats.

Suggested typed events:

- `soulCatcherUnlocked: { areaId: number }`
- `soulDropped: { sourceId: string; soulType: SoulType; quantity: number }`
- `soulNodePurchased: { nodeId: string; previousLevel: number; newLevel: number; soulType: SoulType; cost: number }`
- `soulCatcherReset: undefined`

## Implementation order

1. Promote and validate authored JSON; define Soul/node/effect types and explicit node-neighbor graph.
2. Save migration.
3. SoulCatcherSystem including reveal graph and reset.
4. Area 2 boss + enemy defeat event integration.
5. Approved HUD recomposition and committed icons.
6. Unlock popup and locked-button toast.
7. Enemy Soul preview + reward popup.
8. Stats integration including typed defence and Soul drop stats.
9. Radial tree UI: mystery/revealed/purchased states, drag + pinch zoom, explicit Purchase.
10. Dedicated Reset Soul Catcher control using existing simple reset confirmation.
11. iPhone portrait validation.

## Open design questions

**None for the currently specified v1 scope.**

The previous open questions are resolved: existing-save behavior, locked-button toast, unlock timing, five-currency banner, mystery-node behavior, neighbor-based reveal, explicit one-level purchasing, tree drag/zoom, reset behavior, Uncommon base yield, hero-death behavior, rarity-specific Soul yield and reset confirmation UX are all decided above. Older popup/icon placement questions were superseded by the approved HUD and canonical icon revisions.

Future Rare/Epic/Legendary branches will require their own balance/design decisions when that scope is added; they are intentionally not blockers for this implementation.

## Acceptance criteria

- Stats and Spawn retain their approved positions; Settings moves beside the narrowed combat banner.
- Soul Catcher + Bag fit in the marked open right-side space; bottom Inventory button is removed.
- Existing saves that defeated the Area 2 boss immediately gain access and see the unlock announcement once.
- Locked Soul Catcher tap displays exactly `Defeat area 2 boss to unlock Soul Catcher`.
- Unlock announcement follows the normal boss/route presentation immediately.
- The Soul banner always shows all five rarity-colored currencies; unavailable balances show `0` rather than being greyed/hidden.
- Common non-crystal enemies drop Common Souls after feature unlock; crystals never do.
- Hero death never removes Soul balances or purchased Soul Catcher progression.
- Every Soul-yield node modifies exactly one authored rarity.
- SC-20 is reachable around two-thirds of the numbered tree, costs 250 Common Souls and unlocks base 1 Uncommon Soul from every Uncommon enemy.
- SC-21..SC-25 spend Uncommon Souls at low entry costs.
- Every upgrade node grants only one stat/effect.
- Blunt, Slash and Piercing defence upgrades exist and provide +5 defence per level up to 10 levels.
- Late Common base costs are generally 250–300 rather than 400–500.
- Tree progression is neighbor-based, not layer-gated: purchasing level 1 reveals all connected neighboring nodes.
- Each authored node generally has 1–3 neighboring connections.
- Mystery nodes are visible but expose no details and cannot be clicked.
- Revealed nodes open a detail view; Souls are spent only through an explicit Purchase button, one level at a time.
- Tree supports drag and pinch zoom.
- `RESET SOUL CATCHER` resets all five balances and all node levels to zero while preserving the Area 2 unlock and other game progression.
- Reset Soul Catcher reuses the existing simple reset confirmation interaction.
- Soul balances, node levels and unlock presentation persist correctly.
- Node data remains editable in one JSON file per Soul Catcher layer while graph connections remain independent from layer boundaries.
- Canonical committed SVGs are used throughout the implementation.
