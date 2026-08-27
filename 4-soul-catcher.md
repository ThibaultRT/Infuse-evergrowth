# Soul Catcher progression

## Goal

Add a persistent Soul Catcher upgrade path unlocked by defeating the Area 2 boss. Eligible defeated enemies provide rarity-matched Souls that can be spent in a 30-node radial tree.

The editable node definitions are the balance source of truth:

- `WIP/soul-catcher/nodes/layer-01-core.json` — SC-01
- `WIP/soul-catcher/nodes/layer-02-inner.json` — SC-02..SC-07
- `WIP/soul-catcher/nodes/layer-03-middle.json` — SC-08..SC-17
- `WIP/soul-catcher/nodes/layer-04-outer.json` — SC-18..SC-30

Promote them to `src/data/soul-catcher/` when implementation starts.

## Unlock and drops

- Soul Catcher is visible from game start but greyed/barred until the Area 2 boss is defeated.
- On unlock show `Soul Catcher unlocked!` and `Infuse souls of the defeated enemies and unlock powerful upgrades!` after the normal boss/route presentation.
- Initially only Common enemies drop Souls.
- Base eligible drop = 1 Soul per enemy.
- Crystals never display or drop Souls.
- Locked enemy rarities display no Soul reward at all.
- Uncommon Soul drops are unlocked by SC-20 `Uncommon Resonance`, roughly two-thirds through the 30-node progression.
- SC-20 costs **250 Common Souls** and unlocks base 1 Uncommon Soul per Uncommon enemy.
- Rare/Epic/Legendary Soul unlocks remain future work.
- Soul quantity is shown above enemy HP bars and on defeat as quantity + icon, slightly below the existing stat reward popup.
- Add Soul Drops to the Stats panel, including Base 1 and upgrade contributions.

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

Recommended sizes: 11–14 px in enemy reward labels, 16–20 px in reward popups/stats, 22–28 px in the Soul balance banner. Rare+ may receive a subtle matching glow without changing the silhouette.

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

Recommended locked tap toast: `Defeat the Area 2 boss to unlock Soul Catcher.`

## Skill tree

Use DOM + SVG/CSS, independent from Three.js.

- Layer 1: 1 core node.
- Layer 2: 6 inner nodes.
- Layer 3: 10 middle nodes.
- Layer 4: 13 outer nodes.
- JSON owns node number, ID, description, polar position, max level, cost Soul type, base cost, cost scaling, reward and prerequisites.
- One purchased level reveals connected children unless JSON explicitly requires a higher level.
- Unrevealed descendants may appear as dim mystery silhouettes but hide name/cost/reward.
- Tap a revealed node to open details and an explicit Purchase button.
- Use one-finger pan + pinch zoom; minimum node hit target 44 px.
- Sticky top banner shows all five Soul balances, with unavailable rarities visually locked.

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

### Uncommon branch

| Node | Cost | Max | Single reward |
| --- | ---: | ---: | --- |
| SC-20 Uncommon Resonance | 250 Common | 1 | Unlock Uncommon Soul drops, base 1 |
| SC-21 Uncommon Blunt Ward | 5 Uncommon, +5/level | 10 | +5 Blunt defence/level |
| SC-22 Uncommon Slash Ward | 5 Uncommon, +5/level | 10 | +5 Slash defence/level |
| SC-23 Uncommon Piercing Ward | 5 Uncommon, +5/level | 10 | +5 Piercing defence/level |
| SC-24 Uncommon Harvest | 10 Uncommon, +10/level | 3 | +1 Uncommon Soul/enemy/level |
| SC-25 Uncommon Vitality | 15 Uncommon, +10/level | 5 | +200 Max HP/level |

SC-21..25 all require SC-20 level 1. This creates an immediate five-way use for the new currency rather than unlocking Uncommon Souls at the very end of the tree.

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

## Persistence

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

Derive Soul Catcher availability from existing Area 2 boss progression rather than duplicating an unlock boolean. Existing saves that already defeated the Area 2 boss should unlock immediately with zero Souls and show the announcement once. Hero death does not remove Soul currency or node progression.

## Architecture

Add a focused `SoulCatcherSystem` under `src/systems/`; do not put progression rules in `Game.ts` or UI code.

Responsibilities:

- availability from world progression;
- rarity eligibility;
- Soul yield calculation and grant;
- balances and spending;
- node reveal/purchase validation;
- node effect projection into source-aware hero/Soul stats.

Suggested typed events:

- `soulCatcherUnlocked: { areaId: number }`
- `soulDropped: { sourceId: string; soulType: SoulType; quantity: number }`
- `soulNodePurchased: { nodeId: string; previousLevel: number; newLevel: number; soulType: SoulType; cost: number }`

## Implementation order

1. Promote and validate authored JSON; define Soul/node/effect types.
2. Save migration.
3. SoulCatcherSystem.
4. Area 2 boss + enemy defeat event integration.
5. Approved HUD recomposition and committed icons.
6. Unlock popup.
7. Enemy Soul preview + reward popup.
8. Stats integration including typed defence and Soul drop stats.
9. Radial tree UI.
10. iPhone portrait validation.

## Acceptance criteria

- Stats and Spawn retain their approved positions; Settings moves beside the narrowed combat banner.
- Soul Catcher + Bag fit in the marked open right-side space; bottom Inventory button is removed.
- Common non-crystal enemies drop Common Souls after feature unlock; crystals never do.
- SC-20 is reachable around two-thirds of the numbered tree, costs 250 Common Souls and unlocks Uncommon drops.
- SC-21..SC-25 spend Uncommon Souls at low entry costs.
- Every upgrade node grants only one stat/effect.
- Blunt, Slash and Piercing defence upgrades exist and provide +5 defence per level up to 10 levels.
- Late Common base costs are generally 250–300 rather than 400–500.
- Soul balances, node levels and unlock presentation persist correctly.
- Node data remains editable in one JSON file per layer.
- Canonical committed SVGs are used throughout the implementation.