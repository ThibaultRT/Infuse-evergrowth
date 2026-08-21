# Infuse: Evergrowth

An iOS-friendly active incremental RPG delivered as a Progressive Web App.

## v0.33 vertical slice

- Two authored areas with 30 fixed targets each across Crystal → Legendary tiers
- Area 1's Legendary target is the current boss
- Area 1 contains a boss-gated portal tagged `portal - area 2`
- Defeating the boss opens the portal, briefly focuses the camera on it, and unlocks Area 2
- Walking into the open portal moves the hero to Area 2, whose always-open return portal leads back to Area 1
- Area 2 enemies grant twice the permanent-stat rewards of their Area 1 counterparts
- Low-poly human placeholders for combat enemies and a human hero in starter underwear
- Hero starts at **20 Max HP**, **5 Blunt Attack**, and **0.10 HP/s** passive regeneration
- Central touch joystick for iPhone plus WASD / arrow keys on desktop
- Automatic combat: the hero attacks the nearest living target inside the current weapon range
- Bare hands use **Blunt** damage, shown with a hammer icon
- Targets advertise their current stat loot above the HP bar using only a value + icon
- Stat gains from kills appear on the right as number + icon only and cascade upward
- Fully defeated Common/Uncommon packs show a circular countdown until the first member respawns
- Four equipment slots are shown side by side in a bottom dock, with an Inventory window ready for future equipment
- Per-spawn escalating respawn timers with a local-midnight reset
- Local save for permanent stats, area unlocks, boss progression, inventory, loot rolls, and daily spawn state
- Installable PWA shell deployed through GitHub Pages

## Version source

`package.json` is the single source of truth for the app version. The tiny in-game version label reads that package version at runtime, so a release bump does not require editing the UI separately.

## Balance data

All tunable gameplay numbers live in [`src/data/balance.json`](src/data/balance.json), including:

- hero base HP / attack / regeneration;
- movement and bare-hand combat values (all configured distances are in meters);
- Common enemy base HP / attack;
- tier multipliers, loot rewards, respawn multipliers and colors;
- respawn base time;
- loot roll weights;
- cross-area HP and attack scaling.

Authored map content lives separately in [`src/data/areas.json`](src/data/areas.json): area origins, spawn positions/groups, boss IDs, and portal definitions/tags.

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

## Current damage types

| Type | Current source | Base attack |
| --- | --- | ---: |
| Blunt | Bare hands | 5 |

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
