# Soul Catcher progression

## Goal

Add a persistent Soul Catcher progression path unlocked by defeating the Area 2 boss. The feature adds rarity-colored soul currency drops, a mobile-first radial skill tree, and a new right-side HUD rail that also becomes the home of the Inventory button.

This is a feature specification only. The proposed 30-node balance is stored as editable JSON drafts under `WIP/soul-catcher/nodes/` and should be promoted to `src/data/soul-catcher/` when implementation begins.

## Player-facing flow

1. The game starts with a small Soul Catcher icon on the right side of the screen, approximately vertically centered.
2. Until the Area 2 boss is defeated, the icon is disabled, greyed out, and crossed by a diagonal bar.
3. A Bag icon sits directly below it and opens the existing Inventory panel. Remove the `INVENTORY` button from the bottom dock; keep the equipped quick slots there.
4. When the Area 2 boss is defeated for the first time, unlock the Soul Catcher and show:
   - Title: `Soul Catcher unlocked!`
   - Body: `Infuse souls of the defeated enemies and unlock powerful upgrades!`
5. Once unlocked, eligible enemies show a soul reward beside the existing authored stat reward above their HP bar.
6. Initially only Common enemies are eligible. Crystals never show or drop souls. Uncommon/Rare/Epic/Legendary enemies do not show a soul icon until their rarity is unlocked in the tree.
7. Base reward for every eligible enemy is 1 soul matching that enemy's rarity.
8. On defeat, grant the soul immediately, persist it, and show a gain popup containing quantity + soul icon. Position the soul gain stack slightly below the existing stat gain stack so the two do not overlap.
9. Opening Soul Catcher shows a full-screen mobile panel. A compact top banner shows soul balances; below it is the radial node tree.
10. Initially only node SC-01 is actionable. Purchasing a node reveals the cost/reward details of its connected children. One purchased level is enough to reveal children unless a requirement explicitly asks for a higher level.

## Soul rarity and visuals

Reuse the existing enemy rarity palette so rarity language stays consistent everywhere:

| Soul | Color |
| --- | --- |
| Common | `#b8bec8` |
| Uncommon | `#64dc8c` |
| Rare | `#5d98ff` |
| Epic | `#bf75ff` |
| Legendary | `#ffb33d` |

The chosen soul icon should be one monochrome/vector-friendly silhouette tinted by CSS/SVG for each rarity. Do not create five separate art shapes. Crystals (`#8dd9ff`) are excluded from Soul Catcher currency entirely.

## HUD layout

Use HTML/CSS, not Three.js, for these controls.

- Add a right-side vertical rail with two ~48 px minimum touch targets and ~8 px gap.
- Anchor around `top: 50%` and respect the safe-area inset on the right.
- Top: Soul Catcher icon.
- Bottom: Bag / Inventory icon.
- Locked Soul Catcher state: desaturated/grey, reduced opacity, diagonal slash/bar overlay, `aria-disabled=true`.
- Remove the existing bottom-dock inventory button and allow the bottom dock to shrink around the quick slots.
- The existing gain stack currently occupies the right side near 62% height. Move reward gain stacks left enough to clear the new rail; keep stat gains around 62% and soul gains around 66% so the requested vertical separation is obvious.

Recommended locked-icon tap behavior: do not silently ignore it. Show a short toast such as `Defeat the Area 2 boss to unlock Soul Catcher.`

## Enemy HUD and defeat reward

The existing enemy target UI already owns an authored stat reward label and HP bar. Extend that projection rather than creating a second independent world label.

- Add a soul reward element between/alongside the existing reward label and the HP bar.
- Common enemies show `1 + Common Soul icon` immediately after Soul Catcher unlock.
- Quantity updates live when a soul-drop upgrade is purchased.
- Uncommon enemies show nothing until SC-28 is purchased, then show their Uncommon soul icon and quantity.
- Future Rare/Epic/Legendary unlock nodes use the same rule.
- Crystals never create this element visibly and never grant soul currency.
- Death reward: emit a typed soul event, update/persist balance through the Soul Catcher system, then render a soul gain popup from UI code.

## Soul drop stat

Treat soul yield as a source-aware stat, analogous to existing source-aware hero stats:

`(base + additive sources) × multiplicative sources`

For this first slice:

- Common base = 1.
- Uncommon base = 1 once unlocked.
- Rare/Epic/Legendary base = 1 but unavailable/locked.
- Current proposed tree only uses flat additive soul-drop rewards; the multiplicative slot is reserved for future tuning.
- Souls must resolve to an integer per kill. Do not introduce fractional soul currency.

Add a Soul Drops section to the Stats panel. At minimum it should show Common `Base 1`, node additions, and Total. Show Uncommon after it becomes unlocked. Future rarities follow the same projection.

## Skill-tree UI

Use DOM + SVG/CSS. The tree is normal UI and should remain independent of the Three.js scene.

### Layout

The first 30 nodes use four radial layers:

- Layer 1 / Core: 1 node (SC-01).
- Layer 2 / Inner Ring: 6 nodes (SC-02..SC-07).
- Layer 3 / Middle Ring: 10 nodes (SC-08..SC-17).
- Layer 4 / Outer Ring: 13 nodes (SC-18..SC-30).

Each JSON node contains polar layout metadata (`radius`, `angleDeg`) so the renderer does not hard-code coordinates. SVG connection lines are derived from `requires` relationships.

Recommended mobile interaction:

- Full-screen modal/panel.
- Sticky soul-balance banner at top.
- Pannable tree viewport; pinch zoom is useful once the outer ring is visible.
- Minimum interactive node hit target: 44 px.
- Tap a revealed node to open a compact detail card containing title, description, current level/max level, current next-level cost, reward per level, and Purchase button.
- Purchasing one level updates balances and effects immediately.
- Maxed nodes use a distinct filled/completed state.
- Unrevealed descendants may remain visible as anonymous dim silhouettes/lines, but their name/cost/reward stay hidden until their prerequisite is purchased.

## Proposed 30-node balance

Editable source of truth for the proposal:

- `WIP/soul-catcher/nodes/layer-01-core.json` — SC-01.
- `WIP/soul-catcher/nodes/layer-02-inner.json` — SC-02..SC-07.
- `WIP/soul-catcher/nodes/layer-03-middle.json` — SC-08..SC-17.
- `WIP/soul-catcher/nodes/layer-04-outer.json` — SC-18..SC-30.

Cost formula for target level `L` (1-based):

`cost(L) = base + perLevel × (L - 1)`

This deliberately includes the requested example: SC-02 costs 25 Common Souls for level 1, +25 cost each following level, grants +50 Max HP each level, and caps at 10 levels.

SC-28 `Uncommon Resonance` sits at the far edge of the harvest branch. It is a one-level unlock costing 1000 Common Souls and requires SC-26 + SC-27 at level 1. Once purchased, Uncommon enemies start displaying and dropping 1 Uncommon Soul by default. Rare/Epic/Legendary unlocks are intentionally not part of this 30-node slice.

All 30 current nodes cost Common Souls. The schema nevertheless stores `cost.soulType` per node so future layers can spend Uncommon/Rare/Epic/Legendary Souls without a data migration.

## Data model

Promote the WIP JSONs to production files during implementation, for example:

- `src/data/soul-catcher/config.json` — base drops, rarity ordering, unlock source, global tuning.
- `src/data/soul-catcher/layer-01-core.json`
- `src/data/soul-catcher/layer-02-inner.json`
- `src/data/soul-catcher/layer-03-middle.json`
- `src/data/soul-catcher/layer-04-outer.json`

Keep node effects as a discriminated union in TypeScript. Validate IDs, requirements, max levels, soul types, and effect payloads once when authored data is loaded.

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

Add Soul Catcher state in the next save version. Suggested shape:

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

Do not duplicate Area 2 completion as a second authoritative boolean. Soul Catcher availability can be derived from `defeatedBosses` + `areaById(2).bossSpawnId`. `unlockAnnouncementSeen` exists only to control the one-time presentation.

Migration behavior recommendation: an existing save that already defeated the Area 2 boss receives zero soul balances, an empty node map, Soul Catcher immediately unlocked, and the unlock popup once on first load after the feature update.

## Systems and events

Add a focused `SoulCatcherSystem` under `src/systems/` rather than putting rules in `Game.ts` or `ui.ts`.

Responsibilities:

- Determine whether Soul Catcher is available from world progression.
- Determine whether a given enemy tier currently drops souls.
- Calculate current soul drop quantity from base + purchased node effects.
- Grant soul currency on eligible enemy defeat.
- Check node reveal/purchase requirements and affordability.
- Spend soul currency and apply node-level progression.
- Project Soul Catcher stat sources into hero stats / soul-drop stats without UI calculations.

Suggested typed events:

- `soulCatcherUnlocked: { areaId: number }`
- `soulDropped: { sourceId: string; soulType: SoulType; quantity: number }`
- `soulNodePurchased: { nodeId: string; previousLevel: number; newLevel: number; soulType: SoulType; cost: number }`

The existing `bossDefeated` event already provides `areaId`, so the new system can react to Area 2 without hard-coding a spawn ID in presentation code.

## Unlock presentation ordering

Area 2 boss defeat may already trigger the existing boss/gate progression banner. Avoid two overlays fighting each other.

Recommended sequence:

1. Existing boss defeated / route opened banner.
2. Queue the Soul Catcher unlock popup immediately after it clears.
3. Mark `unlockAnnouncementSeen` only when the Soul Catcher popup has actually been presented.

## Implementation slices

1. **Authored data + domain rules** — promote/validate node JSON, define `SoulType`, node/effect types, cost and reveal helpers.
2. **Save migration** — add balances, node levels, announcement state, normalization and migration.
3. **SoulCatcherSystem** — eligibility, yield, grant, purchase and effect projection.
4. **Events / progression integration** — consume Area 2 boss event and enemy-defeat flow without bloating `Game.ts`.
5. **Right HUD rail** — Soul Catcher + Bag buttons; remove bottom Inventory button.
6. **Unlock popup** — queued after boss progression and retroactive for existing qualifying saves.
7. **Enemy soul preview + defeat gain** — rarity-tinted icon, live quantity, separate gain stack.
8. **Stats panel** — Soul Drops breakdown including Base 1.
9. **Skill-tree panel** — banner, pan/zoom radial graph, reveal states, node detail and purchase command.
10. **Mobile validation** — iPhone 12 minimum reference plus iPhone 14/modern portrait; verify touch targets, safe areas, tree navigation, gain-stack overlap and modal scrolling.

## Open design questions

1. **Existing saves:** if the Area 2 boss was already defeated before this feature ships, should Soul Catcher unlock immediately and show the unlock popup once? Recommendation: yes.
2. **Locked HUD icon:** should tapping it show `Defeat the Area 2 boss to unlock Soul Catcher`, or should it do nothing? Recommendation: show the requirement toast.
3. **Unlock popup sequencing:** should the Soul Catcher popup appear after the existing Area 2 boss/gate banner, or replace/merge with it? Recommendation: queue it after the existing banner.
4. **Soul balance banner:** should it always show all five rarities as slots (locked rarities greyed/locked), or show only currently unlocked soul types? Recommendation: show all five so the player can see future progression.
5. **Unrevealed nodes:** should future nodes be completely invisible, or visible as dim mystery nodes with hidden details? Recommendation: visible silhouettes with hidden content.
6. **Multi-level dependency:** does buying level 1 of a multi-level node reveal its children, or must the node be maxed? Recommendation: level 1 reveals children; specific future exceptions can request a higher prerequisite level in JSON.
7. **Node purchase UX:** should a tap purchase immediately, or open a detail card with a Purchase button? Recommendation: detail card + explicit Purchase to avoid accidental soul spending on mobile.
8. **Bulk purchasing:** for multi-level nodes, do you want only `+1 level`, or also a `Buy Max` action? Recommendation: start with +1 only; Buy Max can be added later if repeated taps become annoying.
9. **Tree navigation:** are one-finger pan + pinch zoom acceptable, or do you want the whole 30-node tree always fitted on screen? Recommendation: pan/zoom; fitting 30 readable 44 px nodes into 390 px width would make the tree too cramped.
10. **Reset behavior:** should the current `Reset attributes` / `Reset hero` developer actions also reset Soul Catcher node levels and/or soul balances? Recommendation: no; keep Soul Catcher as separate persistent progression and add a dedicated dev reset only if needed.
11. **Soul drop popup location:** the proposal keeps stat gains near 62% right-side height and soul gains near 66%, both shifted left to clear the new HUD rail. Is that the visual behavior you intended by “slightly lower”? Recommendation: yes.
12. **Soul icon treatment:** should the rarity be conveyed only by tint, or by tint plus a faint matching glow/outline? Recommendation: tint + subtle glow for Rare and above, while preserving the same silhouette.
13. **Uncommon base yield:** once SC-28 is purchased, should every Uncommon enemy drop exactly 1 Uncommon Soul before future modifiers? Recommendation: yes.
14. **Soul Catcher stat effects:** the proposal includes HP, regen, damage, speed, crit/block raw stats and soul yield. Do you want the first 30 nodes to avoid any entirely new combat mechanics (lifesteal, execute, cooldown reduction, etc.)? Recommendation: yes for v1; keep this slice balance-focused and data-driven.
15. **Soul ownership/reset on death:** recommendation is that death never loses souls and never resets tree progress. Confirm this is intended.

## Acceptance criteria

- Before Area 2 boss defeat, Soul Catcher HUD button is visible but barred/disabled; Inventory opens from the Bag button on the right and no bottom Inventory button remains.
- Area 2 boss defeat permanently unlocks Soul Catcher and presents the requested message once.
- Common non-crystal enemies show and grant Common Souls; crystals never do.
- Locked rarities show no soul preview and grant no souls.
- SC-28 unlocks Uncommon previews and drops at base quantity 1.
- Enemy soul preview and defeat popup always reflect the current calculated quantity.
- Stats panel exposes Common soul base drop = 1 and applied node additions.
- Soul balances and purchased node levels survive reloads.
- JSON, not UI code, owns node number/name/description/layout/cost/scaling/reward/max level/required nodes/cost soul type.
- Tree starts from SC-01 and reveals connected node content only as requirements are met.
- All normal UI remains usable at the iPhone 12 portrait reference size without overlapping the new right-side rail.
