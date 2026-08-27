# Inventory Redesign — Devour-style Overview + Item Detail

## Status

WIP implementation plan for the next UI slice. This plan is based on the current `main` branch and the mobile benchmark screenshots from Devour Idle RPG.

The weapon/equipment systems already exist. This slice should primarily reorganize presentation and interaction without moving gameplay calculations into the UI layer.

## Problem in the current implementation

The current Inventory sheet renders, in order:

1. equipped items;
2. bag;
3. selected-item detail inline below the bag.

This becomes unusable as more equipment categories are added because the bag can become very tall and the selected item's details are pushed below it.

There is also a concrete mobile scrolling conflict in the current CSS/input implementation:

- `.modal-sheet` is vertically scrollable;
- `.inventory-bag` currently has `touch-action: none`;
- touch/pointer dragging is implemented on inventory items;
- therefore a vertical gesture beginning on the bag is treated as equipment drag input instead of normal page scrolling.

Do not solve this only by adding a larger fixed-height scroll box inside the bag. The desired UX is a cleaner two-view structure modeled after Devour.

## Target UX

The Inventory becomes two distinct views:

```text
INVENTORY OVERVIEW
  Compact combat summary
  Equipped items
  Bag

ITEM DETAIL
  Item artwork + identity
  Item stats/progression
  Special-power area
  Equip / Unequip
  Ascend
```

The item detail must no longer be rendered inline at the bottom of the Inventory Overview.

Selecting any owned or equipped item opens the Item Detail view.

Closing/backing out of Item Detail returns to the Inventory Overview at the user's previous scroll position.

## 1. Inventory Overview layout

### A. Compact combat summary at the top

Mimic the information density of the Devour Stats header rather than the existing detailed permanent-stat breakdown.

Show three large primary values:

- Total Attack
- Max HP
- HP Regeneration

Use icon + value as the dominant presentation. Labels may exist as compact accessible text/tooltips but should not consume much vertical space.

Below the three primary values, show six compact affinity values:

- Blunt Attack
- Slash Attack
- Piercing Attack
- Blunt Defense
- Slash Defense
- Piercing Defense

Suggested mobile arrangement:

```text
 [Total Attack]   [HP]   [Regen]

 [Blunt ATK] [Slash ATK] [Pierce ATK]
 [Blunt DEF] [Slash DEF] [Pierce DEF]
```

Each affinity card should primarily show its existing damage-type icon + value, not a large text label.

### Stat definitions

The UI must not recreate combat math itself.

Add/use a focused engine-neutral/system selector that returns the same values combat actually uses.

Conceptually:

```ts
type InventoryCombatSummary = {
  totalAttack: number;
  maxHp: number;
  regenPerSecond: number;
  attackByType: Record<DamageType, number>;
  defenseByType: Record<DamageType, number>;
};
```

`attackByType` should sum the effective attack profile of the four weapon slots (`hand1`, `orbit1`, `orbit2`, `orbit3`) grouped by damage type.

An equipped weapon already combines its equipment damage with the player's permanent stat for that weapon's relevant damage type. The summary must reuse the same rule rather than add permanent stats a second time.

`totalAttack` is the sum of the effective attack values of all four active weapon slots.

This is an attack-value summary, not DPS. Do not divide/multiply by attack cooldown unless the design explicitly changes later.

`defenseByType` is the currently equipped defense total for helmet + armor + legs for each damage type.

If a slot has no active attack profile, the summary must follow the same fallback rule as real combat. The UI and combat output must never disagree.

### B. Equipped items directly below stats

Display all currently usable equipment slots in a compact visual section.

Current slot set:

- Hand 1
- Hand 2
- Orbit 1
- Orbit 2
- Helmet
- Armor
- Legs

The visual focus is the equipment artwork, rarity, and Level/Ascend marker rather than slot-name text.

Keep slot identity available through short labels/accessibility text.

The equipped area should remain compact enough that the Bag begins high on the screen.

A Devour-like single compact strip is preferred if all 7 slots can remain comfortably tappable on a 390 CSS-pixel-wide viewport. If that becomes too cramped, use a compact 4 + 3 arrangement instead of enlarging the whole section.

Tapping an equipped item opens its Item Detail view.

Tapping an empty slot should not open a fake detail page.

### C. Bag below equipped items

The Bag is the final section of the Inventory Overview.

Keep category separation, for example:

```text
Weapons
[items...]

Helmets
[items...]

Armor
[items...]

Legs
[items...]
```

Empty categories may be omitted.

The entire Inventory Overview should scroll naturally as one page. Do not create nested vertical scrolling unless a future requirement makes it necessary.

This is important for iOS: a vertical swipe starting directly on an equipment icon must scroll the Inventory Overview normally when the user's gesture is vertical.

## 2. Mobile item sizing

The benchmark shows substantially denser inventory icons than the current implementation.

Target **5 bag icons side by side on an iPhone 14 portrait width**.

The project minimum mobile reference remains 390×844 CSS pixels, so use that as the acceptance viewport.

At ~390 px viewport width, after modal/page horizontal padding, the Bag should still render:

```text
5 columns
```

not the current mobile 3-column layout.

Suggested CSS direction:

```css
.inventory-bag-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
}
```

The exact gap/padding can be tuned visually, but do not solve overflow by reducing to 4 or 3 columns at the iPhone-14 target width.

Equipment artwork should fill most of its square tile. Keep the Level/Ascend progress badge legible but compact.

Approximate target tile size on a 390 px screen: **60–68 CSS px** depending on final modal padding.

Do not hardcode a device-specific physical pixel size; use responsive CSS based on available CSS width.

For wider phones/tablets, allow more columns naturally if desired, but 5 columns at 390 px is the key acceptance target.

## 3. Scrolling and touch interaction

### Remove the current scroll/drag conflict

The current rule making the whole `.inventory-bag` `touch-action: none` blocks normal mobile scrolling.

Change the touch contract so that the Inventory Overview supports vertical panning.

Preferred direction:

- bag/items: `touch-action: pan-y` or normal browser touch behavior;
- a simple tap opens Item Detail;
- Equip/Unequip is performed from Item Detail;
- desktop HTML drag/drop may remain optional, but it must not require disabling touch scrolling on mobile.

The current custom pointer-drag behavior is not necessary for the primary mobile interaction and should not take precedence over scrolling.

If touch drag-to-equip is retained at all, it must require an intentional long press / explicit drag state so a normal swipe scrolls immediately. Simpler is better: for this slice, prioritize tap -> Item Detail -> Equip/Unequip.

### Preserve overview scroll position

When an item is opened:

1. remember the overview scroll position;
2. show Item Detail;
3. when returning, restore the prior overview position.

This matters once the Bag contains many categories/items.

## 4. Item Detail view

Opening an item replaces the Inventory Overview content with a dedicated detail view. Do not append details under the Bag.

The visual hierarchy should follow the attached Devour detail benchmark while retaining Infuse's own styling.

### Header

Show:

- large item artwork;
- item name;
- rarity;
- equipment class;
- damage/defense type icon;
- Level;
- Ascend.

Example:

```text
STORMFANG
Rare · Sword · Slash
Level 12 · Ascend 1
```

### Main values

For a weapon:

- current weapon damage;
- damage per level;
- attack cooldown;
- damage type;
- current Level;
- current Ascend.

For armor:

- current defense;
- defense per level;
- defended damage type;
- current Level;
- current Ascend.

Do not show unrelated statistics.

### Ascend preview

Keep the existing Ascend rule and button.

When Level < 50:

- Ascend button disabled;
- show the rarity-specific remaining copy requirement clearly, e.g. `Ascend at 100 copies`.

When the rarity-specific copy requirement is met:

- show the projected post-Ascend base/current value prominently;
- enable Ascend.

The detail view may use a `current -> after Ascend` treatment similar to Devour's damage preview.

### Special power placeholder

Preserve a dedicated ability/power area for future equipment-specific powers.

Until powers exist:

```text
Hidden power will be unlocked upon Ascend
```

After the first Ascend, keep the existing temporary state:

```text
Power unlocked · ability coming soon
```

Do not remove this section just to save vertical space; the Detail view can scroll independently because it is a dedicated page.

### Actions

Show a clear bottom action area:

- `Equip` if not equipped;
- `Unequip` if equipped;
- `Ascend` when applicable.

For armor, Equip has exactly one compatible slot.

For weapons, there are four compatible weapon slots. The current behavior of only searching Hand 1/Hand 2 and failing with `no free slots!` is not sufficient for the four-slot design.

Recommended weapon equip behavior:

- if exactly one compatible slot is free, equip there directly;
- otherwise open a compact slot picker for H1 / H2 / O1 / O2;
- occupied slots may be selected intentionally to replace their current item;
- the same owned item ID cannot occupy multiple slots simultaneously.

This allows `Equip` to remain useful even when all four weapon slots are occupied.

After Equip/Unequip/Ascend, keep the player on the same Item Detail view and refresh its values immediately.

## 5. View/state structure

Do not implement this by constantly appending/removing arbitrary fragments from one long sheet.

Use a small explicit Inventory UI state, for example:

```ts
type InventoryViewState =
  | { view: 'overview'; scrollTop: number }
  | { view: 'detail'; itemId: string; overviewScrollTop: number };
```

This state is presentation-only and does not belong in the save file.

Suggested DOM structure:

```text
inventory-panel
  inventory-shell
    inventory-header
    inventory-overview
      inventory-summary
      inventory-equipped
      inventory-bag
    inventory-detail
```

Only one of `inventory-overview` / `inventory-detail` is shown at a time.

A Back/X control from detail returns to overview. The Inventory's main close action still closes the whole Inventory panel.

## 6. Architecture boundary

Follow `AGENTS.md`:

- `src/ui.ts` renders values and emits user commands;
- it must not define attack/defense/progression formulas;
- reuse or add a focused pure/system selector for the combat summary;
- Equip/Unequip/Ascend remain commands handled through the existing game/system path;
- do not add this feature's rules to `Game.ts` beyond UI-command wiring/composition.

Potential focused addition:

```text
src/systems/EquipmentSystem.ts
  equipmentCombatSummary(...)
```

or an engine-neutral domain selector if it can operate only on explicit inputs.

The returned summary should be plain values and IDs, with no DOM/Three.js dependencies.

## 7. CSS direction

The current mobile rules should be revised substantially for Inventory rather than patched around the inline-detail layout.

Key requirements:

- iPhone 14 / 390 px: Bag = 5 columns;
- item tiles remain square;
- touch vertical scrolling works when gesture starts on an item;
- Overview uses a single vertical scrolling surface;
- no inline detail after the Bag;
- equipped section stays visually compact;
- Detail view uses the available viewport and scrolls independently when needed;
- safe-area insets remain respected;
- minimum touch target for action buttons remains ~44 px, but bag item tiles themselves can be denser because their full square is tappable.

The current `.inventory-bag { touch-action: none; }` rule should not survive unchanged.

## 8. Implementation order

### Phase 1 — combat summary selector

- expose current Total Attack;
- expose attack totals by Blunt / Slash / Piercing;
- expose defense totals by Blunt / Slash / Piercing;
- expose Max HP and HP regeneration;
- ensure values reuse authoritative combat/equipment/stat calculations.

### Phase 2 — split Overview and Detail

- remove `weapon-detail` from the end of the overview flow;
- add explicit Inventory view state;
- item click switches to Detail;
- Detail close/back returns to previous overview scroll position.

### Phase 3 — Overview composition

- add compact stat summary;
- rebuild equipped section below summary;
- rebuild bag below equipped section;
- keep category headers but use dense 5-column grids.

### Phase 4 — touch/scroll cleanup

- remove mobile scroll blocking from the bag;
- prioritize `pan-y` / normal scrolling;
- remove or downgrade custom touch drag-to-equip if it conflicts;
- verify no accidental item activation after a scroll gesture.

### Phase 5 — Detail actions

- move current item information into dedicated Detail layout;
- preserve Equip/Unequip/Ascend;
- support H1/H2/O1/O2 target selection when needed;
- show Ascend preview and hidden-power placeholder.

### Phase 6 — mobile polish

- inspect at 390×844 CSS pixels;
- verify five Bag items fit side by side;
- verify long inventories scroll from any point in the bag;
- verify the lowest category is reachable;
- verify detail values/actions are reachable without returning to overview;
- verify safe-area and landscape behavior remain acceptable.

## 9. Acceptance criteria

1. Inventory Overview order is **summary -> equipped -> bag**.
2. Item details never appear inline beneath the Bag.
3. Tapping any owned/equipped item opens a dedicated Detail view.
4. Returning from Detail restores the prior Inventory Overview scroll position.
5. A 390 CSS-pixel-wide viewport shows **5 bag item icons per row**.
6. Vertical swiping beginning on a bag item scrolls the Inventory normally on iOS.
7. Multiple item categories can extend beyond one screen and the player can reach all of them.
8. Summary shows Total Attack, HP, Regen, and attack/defense for all three damage types.
9. Summary values are sourced from authoritative gameplay calculations, not duplicated formulas in `ui.ts`.
10. Equipped items are visible above the Bag and tapping one opens Detail.
11. Detail shows relevant Level, Ascend, damage/defense, growth, type and cooldown where applicable.
12. Detail contains Equip/Unequip and Ascend actions.
13. Weapon Equip supports all four weapon slots rather than only the two hand slots.
14. Mobile scrolling is not disabled by inventory drag handling.
15. Existing save data and equipment progression require no schema migration for this UI-only redesign.
16. Code changes must pass `npm run build` and the package version must be bumped according to `AGENTS.md` when implementation begins.
