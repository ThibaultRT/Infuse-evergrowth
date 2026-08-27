# Soul Catcher progression

## Goal

Add a persistent Soul Catcher progression path unlocked by defeating the Area 2 boss. The feature adds rarity-colored soul currency drops, a mobile-first radial skill tree, and extends the existing right-edge HUD column with Soul Catcher and Inventory controls.

This is a feature specification only. The proposed 30-node balance is stored as editable JSON drafts under `WIP/soul-catcher/nodes/` and should be promoted to `src/data/soul-catcher/` when implementation begins.

## Player-facing flow

1. Keep the existing `STATS` and `SPAWN` buttons in their current positions on the upper-right edge.
2. Reduce the width of the large top-left HP/combat banner enough to create a dedicated Settings slot immediately to its right, before the `STATS` column. Move the existing Settings wheel into that slot.
3. Add a small Soul Catcher button farther down the same right edge, approximately around the vertical middle of the playable view.
4. Until the Area 2 boss is defeated, the Soul Catcher icon is disabled, greyed out, and crossed by a diagonal bar.
5. Add a Bag / Inventory button directly below Soul Catcher. It opens the existing Inventory panel. Remove the `INVENTORY` button from the bottom dock; keep the four equipped quick slots there.
6. When the Area 2 boss is defeated for the first time, unlock the Soul Catcher and show:
   - Title: `Soul Catcher unlocked!`
   - Body: `Infuse souls of the defeated enemies and unlock powerful upgrades!`
7. Once unlocked, eligible enemies show a soul reward beside the existing authored stat reward above their HP bar.
8. Initially only Common enemies are eligible. Crystals never show or drop souls. Uncommon/Rare/Epic/Legendary enemies do not show a soul icon until their rarity is unlocked in the tree.
9. Base reward for every eligible enemy is 1 soul matching that enemy's rarity.
10. On defeat, grant the soul immediately, persist it, and show a gain popup containing quantity + soul icon. Position the soul gain slightly below the existing stat gain so the two do not overlap.
11. Opening Soul Catcher shows a full-screen mobile panel. A compact top banner shows soul balances; below it is the radial node tree.
12. Initially only node SC-01 is actionable. Purchasing a node reveals the cost/reward details of its connected children. One purchased level is enough to reveal children unless a requirement explicitly asks for a higher level.

## Production icon assets — approved

Do not ask implementation tooling to redraw or reinterpret the concept icons. Production-ready SVG assets are committed under `public/icons/` and should be used directly:

- `public/icons/soul-skull.svg` — selected V5 flaming-skull Soul icon. This is the canonical soul silhouette for every rarity.
- `public/icons/soul-catcher.svg` — compact dreamcatcher icon for the right-edge Soul Catcher button and Soul Catcher panel branding.
- `public/icons/inventory-bag.svg` — compact bag icon for the new right-edge Inventory button.

The assets are intentionally simple, high-contrast SVG silhouettes designed to remain readable at small HUD sizes. They are project-owned assets and need no external attribution entry.

### Implementation usage

Use the exact SVGs rather than emoji, icon fonts, generated substitutes or a 3D model.

For the soul icon, use `soul-skull.svg` as a CSS mask so one source file can be tinted to the enemy rarity color:

```css
.soul-icon {
  width: 14px;
  height: 14px;
  display: inline-block;
  background: currentColor;
  -webkit-mask: var(--vite-base-aware-soul-icon-url) center / contain no-repeat;
  mask: var(--vite-base-aware-soul-icon-url) center / contain no-repeat;
}
```

The exact Vite-base-aware URL mechanism may follow the project's existing asset conventions; do not hard-code `/Infuse-evergrowth/` inside feature code. The same SVG must serve Common, Uncommon, Rare, Epic and Legendary; rarity is conveyed through color and optional CSS glow only.

Recommended rendered sizes:

- Soul above enemy HP bar: 11–14 CSS px.
- Soul defeat popup: 14–18 CSS px.
- Soul balance banner / Stats: 16–20 CSS px.
- Soul Catcher right-edge button artwork: approximately 28–34 CSS px inside a >=44 px touch target.
- Inventory Bag right-edge button artwork: approximately 28–34 CSS px inside a >=44 px touch target.

The locked Soul Catcher diagonal bar/slash should be CSS overlay styling, not another image asset, so it can scale cleanly with the button.

## Soul rarity and visuals

The **V5 flaming skull** is selected and final. Use `public/icons/soul-skull.svg` for every soul rarity and recolor that one silhouette using the existing enemy rarity palette:

| Soul | Color |
| --- | --- |
| Common | `#b8bec8` |
| Uncommon | `#64dc8c` |
| Rare | `#5d98ff` |
| Epic | `#bf75ff` |
| Legendary | `#ffb33d` |

Crystals (`#8dd9ff`) are excluded entirely. A subtle rarity-colored glow may be added with CSS, especially for Rare and above, but the underlying shape must remain identical.

## Right-edge HUD layout — approved direction

The latest portrait mockup is the layout reference. Do **not** build one centered rail containing every right-side control. Preserve the existing upper-right hierarchy and use the free vertical space below it.

### Upper controls

- `STATS`: unchanged position.
- `SPAWN`: unchanged position directly below `STATS`.
- Settings wheel: move from its current lower/right location to a compact square immediately to the right of the HP/combat banner and immediately left of the `STATS` button.
- Shrink the HP/combat banner horizontally only as much as required to fit this Settings square. Preserve its information, typography hierarchy, HP bar, and overall height.
- Settings, Stats and Spawn remain visually consistent with the existing dark HUD style.

### Progression controls

Use the currently open right-edge space below the upper controls:

- Soul Catcher button first, using `public/icons/soul-catcher.svg`.
- Bag / Inventory button directly below it, using `public/icons/inventory-bag.svg`.
- Align both buttons to the same right-edge column used by the upper controls where practical.
- Do not force the pair to exact `top: 50%`; their position should follow the approved visual mockup and adapt to available portrait height.
- Keep a clear gap between `SPAWN` and Soul Catcher so this reads as a second functional group rather than a five-button toolbar.
- Target ~48 px minimum touch areas, with the rendered icon smaller inside the button.
- Respect `env(safe-area-inset-right)`.
- Locked Soul Catcher: desaturated/grey, reduced opacity, diagonal slash/bar overlay, `aria-disabled=true`.
- Bag remains available independently of Soul Catcher progression.

### Bottom dock

- Remove the text `INVENTORY` button completely.
- Preserve H1, H2, O1 and O2 quick-slot controls.
- Let the bottom dock contract to the four slots rather than leaving an empty Inventory-sized area.

### Responsive constraints

The approved composition must remain valid at the iPhone 12 portrait reference size and modern iPhone portrait sizes:

- Never overlap the Stats/Spawn group.
- Never overlap the HP/combat banner with the Settings button.
- Soul Catcher and Bag must remain entirely on-screen above the bottom controls.
- Prefer reducing inter-group vertical spacing slightly on short screens before reducing touch targets below 44 px.
- Reward gain popups must avoid the right-edge control column; shift their anchor left when necessary.

Recommended locked Soul Catcher tap behavior: show `Defeat the Area 2 boss to unlock Soul Catcher.`

## Enemy HUD and defeat reward

Extend the existing enemy target UI rather than creating a second independent world label.

- Add a soul reward element beside the existing reward information above the HP bar using `public/icons/soul-skull.svg`.
- Common enemies show `1 + Common Soul icon` after Soul Catcher unlock.
- Quantity updates live when a soul-drop upgrade is purchased.
- Uncommon enemies show nothing until SC-28 is purchased, then show their Uncommon soul icon and quantity.
- Future Rare/Epic/Legendary unlock nodes use the same rule.
- Crystals never visibly create or grant soul currency.
- Death reward: emit a typed soul event, update/persist balance through Soul Catcher system, then render a soul gain popup from UI code using the same skull asset.

## Soul drop stat

Treat soul yield as a source-aware stat:

`(base + additive sources) × multiplicative sources`

For this slice:

- Common base = 1.
- Uncommon base = 1 once unlocked.
- Rare/Epic/Legendary base = 1 but unavailable/locked.
- Current tree uses flat additive soul-drop rewards; multiplicative sources are reserved for future tuning.
- Souls always resolve to integers.

Add a Soul Drops section to Stats. At minimum show Common `Base 1`, node additions, and Total. Show Uncommon once unlocked. Use the canonical skull icon here as well.

## Skill-tree UI

Use DOM + SVG/CSS, independent from Three.js.

### Layout

- Layer 1 / Core: 1 node (SC-01).
- Layer 2 / Inner Ring: 6 nodes (SC-02..SC-07).
- Layer 3 / Middle Ring: 10 nodes (SC-08..SC-17).
- Layer 4 / Outer Ring: 13 nodes (SC-18..SC-30).

Each JSON node contains polar layout metadata (`radius`, `angleDeg`). SVG connection lines derive from `requires` relationships.

Recommended mobile interaction:

- Full-screen modal/panel.
- Sticky soul-balance banner at top.
- Pannable tree viewport with pinch zoom.
- Minimum node hit target: 44 px.
- Tap a revealed node for detail card: title, description, level/max, next cost, reward and Purchase.
- Purchasing one level updates balances/effects immediately.
- Maxed nodes use a distinct completed state.
- Unrevealed descendants may remain as anonymous dim silhouettes/lines while name/cost/reward stay hidden.

## Proposed 30-node balance

Editable source of truth:

- `WIP/soul-catcher/nodes/layer-01-core.json` — SC-01.
- `WIP/soul-catcher/nodes/layer-02-inner.json` — SC-02..SC-07.
- `WIP/soul-catcher/nodes/layer-03-middle.json` — SC-08..SC-17.
- `WIP/soul-catcher/nodes/layer-04-outer.json` — SC-18..SC-30.

Cost formula for target level `L`:

`cost(L) = base + perLevel × (L - 1)`

SC-02 deliberately implements the requested example: 25 Common Souls at level 1, +25 cost each level, +50 Max HP per level, max 10.

SC-28 `Uncommon Resonance` sits at the far edge of the harvest branch. It costs 1000 Common Souls, has one level, and requires SC-26 + SC-27 at level 1. It unlocks Uncommon enemies displaying and dropping 1 Uncommon Soul by default. Rare/Epic/Legendary unlocks are future work.

All 30 current nodes cost Common Souls, but every node explicitly stores `cost.soulType` for future layers.

## Data model

Promote WIP JSONs during implementation:

- `src/data/soul-catcher/config.json`
- `src/data/soul-catcher/layer-01-core.json`
- `src/data/soul-catcher/layer-02-inner.json`
- `src/data/soul-catcher/layer-03-middle.json`
- `src/data/soul-catcher/layer-04-outer.json`

Keep node effects as a discriminated union in TypeScript. Validate IDs, requirements, max levels, soul types and effect payloads on load.

Suggested node shape:

```json
{
  "number": 2,
  "id": "SC-02",
  "name": "Soulbound Vitality",
  "description": "Captured souls reinforce the hero's body.",
  "position": { "angleDeg": -90, "radius": 1 },
  "maxLevel": 10,
  "cost": {
    "soulType": "common",
    "base": 25,
    "perLevel": 25,
    "formula": "base + perLevel * (level - 1)"
  },
  "reward": {
    "effects": [{ "type": "maxHpAdditive", "amountPerLevel": 50 }],
    "display": "+50 Max HP per level"
  },
  "requires": [{ "nodeId": "SC-01", "level": 1 }]
}
```

## Persistent state

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

Do not duplicate Area 2 completion as a second authoritative boolean. Derive Soul Catcher availability from `defeatedBosses` + `areaById(2).bossSpawnId`.

Recommended migration: an existing save that already defeated the Area 2 boss gets zero balances, empty node levels, immediate Soul Catcher availability and the unlock popup once.

## Systems and events

Add focused `SoulCatcherSystem` under `src/systems/`.

Responsibilities:

- Determine availability from world progression.
- Determine which enemy tiers currently drop souls.
- Calculate soul quantity.
- Grant currency.
- Check reveal/purchase requirements and affordability.
- Spend currency and apply node progression.
- Project Soul Catcher stat sources without UI calculations.

Suggested events:

- `soulCatcherUnlocked: { areaId: number }`
- `soulDropped: { sourceId: string; soulType: SoulType; quantity: number }`
- `soulNodePurchased: { nodeId: string; previousLevel: number; newLevel: number; soulType: SoulType; cost: number }`

Use the existing `bossDefeated` event's `areaId`; presentation code should not hard-code the Area 2 boss spawn ID.

## Unlock presentation ordering

1. Existing boss defeated / route opened banner.
2. Soul Catcher unlock popup immediately after it clears.
3. Mark `unlockAnnouncementSeen` only once the Soul Catcher popup is presented.

## Implementation slices

1. **Authored data + domain rules** — promote/validate JSON and define Soul types/effects/cost/reveal helpers.
2. **Save migration** — balances, node levels and announcement state.
3. **SoulCatcherSystem** — eligibility, yield, grant, purchase and effects.
4. **Events/progression integration** — consume Area 2 boss and enemy defeat flows.
5. **HUD recomposition** — preserve Stats/Spawn, shrink HP banner width, move Settings into the freed upper slot, use the committed Soul Catcher + Bag assets in the open right-edge space, remove bottom Inventory.
6. **Unlock popup** — queue after boss progression and support existing qualifying saves.
7. **Enemy soul preview + defeat gain** — use the committed V5 skull asset, rarity tint, quantity and separate gain placement.
8. **Stats panel** — Soul Drops breakdown including Base 1 and canonical skull icon.
9. **Skill-tree panel** — balances, radial graph, reveal states, detail and purchase.
10. **Mobile validation** — iPhone 12 minimum plus modern portrait; verify icon readability at actual CSS sizes, all five right-side controls, safe areas, bottom dock, reward popups, tree navigation and modal scrolling.

## Open design questions

1. Existing saves: immediately unlock and show popup once after migration? Recommendation: yes.
2. Locked Soul Catcher tap: requirement toast or nothing? Recommendation: toast.
3. Unlock popup: after normal boss/gate banner or merged? Recommendation: after.
4. Soul banner: all five rarity slots greyed/locked as needed, or only unlocked? Recommendation: all five.
5. Unrevealed nodes: invisible or mystery silhouettes? Recommendation: silhouettes.
6. Does level 1 reveal children or must multi-level nodes be maxed? Recommendation: level 1.
7. Node purchase: direct tap or detail + Purchase? Recommendation: explicit Purchase.
8. Multi-level buying: +1 only or Buy Max too? Recommendation: +1 initially.
9. Tree navigation: pan + pinch zoom acceptable? Recommendation: yes.
10. Developer resets: should Reset attributes/hero erase Soul Catcher? Recommendation: no.
11. Soul rarity glow: tint only or tint + subtle glow? Recommendation: subtle glow, especially Rare+. The icon silhouette itself is now fixed.
12. Uncommon base yield after SC-28: exactly 1? Recommendation: yes.
13. Upgrade scope: existing stats + soul yield only, or new mechanics? Recommendation: existing mechanics for v1.
14. Hero death: recommendation is no loss of souls or node progress. Confirm.
15. Future soul-yield bonuses: rarity-specific or `+1 any eligible soul`? Recommendation: rarity-specific.

The right-edge HUD placement and V5 skull icon choice are no longer open questions.

## Acceptance criteria

- `STATS` remains in its current upper-right position.
- `SPAWN` remains in its current position below Stats.
- The HP/combat banner is narrowed sufficiently to place Settings immediately to its right and left of Stats without overlap.
- Soul Catcher and Bag occupy the open right-edge space below the upper controls as a distinct second group.
- Soul Catcher uses `public/icons/soul-catcher.svg`; Bag uses `public/icons/inventory-bag.svg`.
- Before Area 2 boss defeat, Soul Catcher is visible but barred/disabled.
- Inventory opens from Bag and no bottom Inventory button remains; H1/H2/O1/O2 remain.
- Area 2 boss defeat permanently unlocks Soul Catcher and presents the requested message once.
- All soul displays use `public/icons/soul-skull.svg`; implementations must not substitute a different skull/soul graphic.
- Common non-crystal enemies show and grant Common Souls; crystals never do.
- Locked rarities show no soul preview and grant no souls.
- SC-28 unlocks Uncommon previews and base drop 1.
- Enemy soul preview and defeat popup reflect calculated quantity.
- Stats exposes Common soul base drop = 1 and node additions.
- Soul balances and purchased node levels survive reloads.
- JSON owns node number/name/description/layout/cost/scaling/reward/max level/requirements/cost soul type.
- Tree starts from SC-01 and reveals connected content according to requirements.
- At iPhone 12 portrait size, the committed SVGs remain legible and HP banner, Settings, Stats, Spawn, Soul Catcher, Bag, reward popups, joystick and bottom quick-slot dock do not overlap.