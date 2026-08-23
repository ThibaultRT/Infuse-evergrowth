# Infuse: Evergrowth

An iOS-friendly active incremental RPG delivered as a Progressive Web App.

## v0.44.1 vertical slice

- Two authored adjacent areas with 30 fixed targets each across Crystal → Legendary tiers
- Area 1's Legendary target is the current boss
- Area 1 and the darker ashwood Area 2 meet at a shared, boss-gated physical passage
- Defeating the boss opens the gate, briefly focuses the camera on it, and unlocks Area 2
- Walking through the open gate crosses the shared boundary; Area 2 remains open for the return journey
- Area 2 enemies grant twice the permanent-stat rewards of their Area 1 counterparts
- Animated Quaternius humanoids, an equipment-driven Ranger hero, visible dual-hand weapons, armor slots, and orbit weapon slots
- Hero starts at **20 Max HP**, **3 Blunt Attack**, and **0.10 HP/s** passive regeneration
- Central touch joystick for iPhone plus WASD / arrow keys on desktop
- Automatic combat: each active hand/orbit source attacks independently when its own cooldown and range permit
- Hero attacks use cyclic combat affinities to double weakness damage and halve resisted damage, with area defaults and per-spawn enemy overrides
- Enemy attacks ignore affinities; matching equipped helmet/armor/boots instead provide flat damage reduction
- Bare hands use **Blunt** damage
- Rare equipment drops are resolved from area-specific loot tables and enemy-tier rarity ceilings
- Equipment has persistent Level / Ascend progression and can be equipped through the inventory UI
- Targets advertise their current permanent-stat reward above the HP bar
- Stat gains and equipment drops use restrained reward feedback suited to portrait play
- Fully defeated Common/Uncommon packs show a circular countdown until the first member respawns
- Per-spawn escalating respawn timers reset at local midnight
- Local save covers permanent stats, area unlocks, boss progression, inventory/equipment progression, loot rolls, and daily spawn state
- Installable PWA shell deployed through GitHub Pages

## Version source

`package.json` is the single source of truth for the app version. The in-game version label reads that package version at runtime, so a release bump does not require editing the UI separately.

## Data sources

Tunable gameplay values live in [`src/data/balance.json`](src/data/balance.json), including hero baselines, movement/combat values, enemy scaling, tier rewards, respawn timing, equipment-drop chances, affinity multipliers, and equipment progression coefficients.

Authored content is kept separate:

- [`src/data/areas.json`](src/data/areas.json): area origins, fixed spawns/groups, explicit bosses, gates, affinities, and environment data
- [`src/data/equipment.json`](src/data/equipment.json): weapon and armor definitions
- [`src/data/equipment-loot-tables.json`](src/data/equipment-loot-tables.json): area-specific equipment pools/unlocks

## Area scaling

Common enemy stats define the baseline for each area:

```text
Common HP(area) = commonBaseHp × hpGrowthPerArea^(area - 1)
Common Attack(area) = commonBaseAttack × area
```

Current HP growth is **4.65× per area**. Tier multipliers are applied after the area scaling.

With the current values:

- Area 1 Common: 32 HP
- Area 2 Common: ~149 HP
- Area 15 Common: ~70.7B HP
- Area 15 Legendary: ~990B HP

This is intentionally aimed at a ~15-area progression ending around billions to roughly one trillion HP for the top tier.

## Combat affinities and equipment

Current explicit damage types are:

| Type | Current examples |
| --- | --- |
| Blunt | Bare hands, hammers, Area 1 enemy attacks |
| Slash | Swords, Area 2 enemy attacks |
| Piercing | Spears and matching armor mitigation |

Hero attacks use the enemy's authored weakness/resistance relationship. Enemy attacks do not use that affinity multiplier against the hero; equipped armor instead subtracts matching flat defense.

Both hand slots are independent attack sources. Equipment definitions and owned progression are separate so static item data does not become duplicated save state.

For equipped weapons, total attack damage is:

```text
weapon attack = calculated weapon damage + hero attack stat for that weapon's damage type
```

The hero stat is persistent across equipment changes. For example, permanent Blunt gains earned while farming Area 1 continue to apply when switching from a Common hammer to an Uncommon hammer; only the weapon contribution changes. A bare hand is not added as another damage term on top of a weapon.

Ascend intentionally increases both the weapon's starting power and its growth rate. A new Ascend starts from the configured multiple of the previous Ascend's Level-50 damage, and the current `perLevelMultiplierPerAscend = 2` means damage gained per level also doubles with each Ascend.

## Architecture and work-in-progress docs

Long-lived contributor/agent rules are in [`AGENTS.md`](AGENTS.md).

- [`implementation-cleanup.md`](implementation-cleanup.md) contains only remaining architecture cleanup work.
- [`WIP/graphical.md`](WIP/graphical.md) records the durable visual direction; slices 1–9 are complete and slice 10 is the remaining optimization/release-validation pass.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The Vite base path is configured for GitHub Pages at `/Infuse-evergrowth/`.

## GitHub Pages

A workflow in `.github/workflows/deploy-pages.yml` builds and deploys `dist/` on pushes to `main`.
