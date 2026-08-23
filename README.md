# Infuse: Evergrowth

An iOS-friendly active incremental RPG delivered as a Progressive Web App.

## v0.33 vertical slice

- Two authored areas with 29 fixed targets each and per-revival HP/reward rolls
- Area 1's third Uncommon target is the current boss; Area 2's Rare target is its boss
- Area 1 and the darker ashwood Area 2 meet at a shared, boss-gated physical passage
- Defeating the boss opens the gate, briefly focuses the camera on it, and unlocks Area 2
- Walking through the open gate crosses the shared boundary; Area 2's side remains open for the return journey
- Animated Quaternius humanoids, an equipment-driven Ranger hero, dual hand weapons, and trial orbit slots
- Hero starts at **20 Max HP**, **5 Blunt Attack**, and **0.10 HP/s** passive regeneration
- Central touch joystick for iPhone plus WASD / arrow keys on desktop
- Automatic combat: the hero attacks the nearest living target inside the current weapon range
- Hero attacks use cyclic combat affinities to double weakness damage and halve resisted damage, with area defaults and per-spawn enemy overrides
- Enemy attacks ignore affinities; matching equipped armor instead provides flat damage reduction
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
- enemy attack scaling;
- tier respawn multipliers and colors;
- respawn base time.
- combat affinity multipliers.

Authored map content lives separately in [`src/data/areas.json`](src/data/areas.json): area origins, spawn positions/groups, boss IDs, per-spawn HP/reward ranges, and gate definitions/tags.

## Authored difficulty

Enemy HP and permanent rewards are authored per spawn rather than derived from area/tier scaling. Each living occupant rolls HP, a reward type, and its reward amount from that spawn's configured ranges; a fresh roll is made on every revival and persisted with the spawn. Enemy attack damage continues to use the existing area/tier scaling.

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
