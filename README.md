# Infuse: Evergrowth

An iOS-friendly active incremental RPG delivered as a Progressive Web App.

## Current vertical slice

- Three authored, continuously connected areas with **101 fixed targets total** and per-revival HP/reward rolls
- Area 1 population: 10 Crystals, 15 Commons, 3 Uncommons, 1 Rare; `area1-uncommon-03` is the gate boss
- Area 2 population: 17 Crystals, 7 Commons, 3 Uncommons, 1 Rare, 1 Epic; `area2-rare-01` is its boss
- Area 1 and the darker ashwood Area 2 meet at a shared, boss-gated physical passage
- Defeating the explicit boss opens the gate, briefly focuses the camera on it, and unlocks the destination area
- Walking through the open gate crosses the shared boundary; Area 2 remains open for the return journey
- Animated Quaternius humanoids, an equipment-driven Ranger hero, one visible hand weapon, three orbit weapons, and armor slots
- Hero starts at **20 Max HP**, **3 Blunt Attack**, and **0.10 HP/s** passive regeneration
- Central touch joystick for iPhone plus WASD / arrow keys on desktop
- Automatic combat: each active hand/orbit source attacks independently when its own cooldown and range permit
- Hero attacks use cyclic combat affinities to double weakness damage and halve resisted damage, with area defaults and per-spawn enemy overrides
- Enemy attacks ignore affinities; matching equipped helmet/armor/boots instead provide flat damage reduction
- Rare equipment drops are resolved from area-specific loot tables and enemy-tier rarity ceilings
- Equipment has persistent Level / Ascend progression and can be equipped through the inventory UI
- Each spawn authors its own HP range and allowed permanent rewards; one roll is persisted for that life and rerolled on revival
- Permanent rewards can increase Max HP, HP/s regeneration, or a specific damage-type attack stat
- Stat gains and equipment drops use restrained reward feedback suited to portrait play
- Fully defeated Common/Uncommon packs show a circular countdown until the first member respawns
- Per-spawn escalating respawn timers reset at local midnight
- Save schema **v19** preserves permanent stats, area unlocks, boss progression, inventory/equipment progression, daily spawn state, each spawn's current per-life roll, and minion progression
- One persistent Imp minion can roam and fight across unlocked connected areas, keep its own kill rewards and equipment, and respawn at the Area 1 Summoning Pit
- Installable PWA shell deployed through GitHub Pages
- Renderer-independent live-world simulation; Three.js views mirror plain gameplay positions and life state

## Version source

`package.json` is the single source of truth for the app version. The in-game version label reads that package version at runtime, so a release bump does not require editing the UI separately.

## Data sources

Tunable gameplay values live in [`src/data/balance.json`](src/data/balance.json), including hero baselines, movement/combat values, tier respawn multipliers, equipment-drop chances, affinity multipliers, and equipment progression coefficients.

Authored content is kept separate:

- [`src/data/areas/`](src/data/areas): one authored JSON file per area plus the world connection manifest; each spawn owns its HP, rewards, and attack damage
- [`src/data/equipment.json`](src/data/equipment.json): weapon and armor definitions
- [`src/data/equipment-loot-tables.json`](src/data/equipment-loot-tables.json): area-specific equipment pools/unlocks

## Authored spawn difficulty

Enemy HP and permanent rewards are no longer derived from one global area/tier HP-and-reward formula.

Each authored spawn defines:

```text
hp: { min, max }
rewards: [{ stat, min, max }, ...]
attackDamage: number
isBoss: optional explicit boss marker
```

When a spawn gets a new life, the game rolls:

1. its Max HP inside the authored HP range;
2. one allowed reward definition;
3. that reward's amount inside its authored range.

The complete roll is persisted in the save for that life, so the HP and reward shown to the player do not change until the spawn revives. A fresh roll is generated on revival or the local-midnight daily reset.

Enemy attack damage is read directly from each spawn's `attackDamage`. Boss progression is driven by authored boss identity rather than assuming that a particular rarity is always a boss.

## Combat affinities and equipment

Current explicit damage types are:

| Type | Current examples |
| --- | --- |
| Blunt | Hammers and Area 1 enemy attacks |
| Slash | Swords, Area 2 enemy attacks |
| Piercing | Spears and matching armor mitigation |

### Affinity triangle

Arrows mean **deals bonus damage to**:

```text
Slash ──▶ Blunt ──▶ Piercing ──▶ Slash
```

- **Slash → Blunt:** 2× damage
- **Blunt → Piercing:** 2× damage
- **Piercing → Slash:** 2× damage
- The reverse matchup is resisted at 0.5× damage.

### Common weapon quick reference

| Common weapon | Damage type | Base damage | Attack interval | Attack speed | Quick memory |
| --- | --- | ---: | ---: | ---: | --- |
| Militia Shortsword | Slash | 8 | 1.0 s | 1.00 hit/s | Fastest, lighter hits |
| Ashwood Spear | Piercing | 12 | 1.5 s | 0.67 hit/s | Middle ground |
| Blacksmith's Hammer | Blunt | 15 | 2.0 s | 0.50 hit/s | Slowest, heavier hits |

Hero attacks use the enemy's authored weakness/resistance relationship. Enemy attacks do not use that affinity multiplier against the hero; equipped armor instead subtracts matching flat defense.

New heroes begin with a Level 1 Common hammer equipped. The held weapon uses the hero attack animation; three additional weapons attack asynchronously from orbit. Orbit 1 unlocks with Area 2. Empty slots do not attack. Equipment definitions and owned progression are separate so static item data does not become duplicated save state, and Ascend copy requirements are rarity-specific.

For equipped weapons, total attack damage is:

```text
weapon attack = calculated weapon damage + hero attack stat for that weapon's damage type
```

The hero stat is persistent across equipment changes. For example, permanent Blunt gains continue to apply when switching from a Common hammer to an Uncommon hammer; only the weapon contribution changes.

Ascend intentionally increases both the weapon's starting power and its growth rate. A new Ascend starts from the configured multiple of the previous Ascend's Level-50 damage, and the current `perLevelMultiplierPerAscend = 2` means damage gained per level also doubles with each Ascend.

## Autonomous minion

The Layer 1 Soul Catcher bonus node `SC-M01` (Minion Covenant) appears after `SC-20`. Its first purchase costs 30 Uncommon Souls and permanently unlocks one Imp without a separate summon fee. It leaves the original `SC-21` and the Layer 2 XP threshold unchanged. After a Soul Catcher reset, a repeat purchase grants the normal XP but no additional free minion. A development-only command can grant the same first unlock without spending Souls or XP.

The Imp has a persisted color, location, health, stats, private inventory, equipment-copy ledger, Soul contribution totals, and a 30-second death deadline. It can pursue reachable enemies and crystals across unlocked areas while the hero is elsewhere. Below 30% HP after a kill, it stops to recover until 75% HP; nearby threats can interrupt recovery. Combat advances while the game is running; it does not catch up missed combat after the browser was away. A device-local anti-idle rule pauses minion activity after five minutes without input. The development build exposes a setting to disable that rule for debugging.

The Summoning Pit beside the Area 1 fountain opens the minion management panel. Sacrificing the roster transfers 50% of its kill-earned stats and 100% of its lifetime earned equipment copies to the hero. Souls from minion kills are already in the player's balance and are not granted again. The first paid replacement costs 30 Uncommon Souls; each later paid summon costs ten times the previous one. Active capacity is currently one. Tuning lives in [`src/data/balance.json`](src/data/balance.json); persistence and reward ownership rules are documented in [`ARCHITECTURE.md`](ARCHITECTURE.md).

Possible later extensions include more active minions, offline combat catch-up, manual orders or equipment control, naming, and new species. None is part of the current implementation.

## Architecture and work-in-progress docs

Long-lived contributor/agent rules are in [`AGENTS.md`](AGENTS.md).

- [`ARCHITECTURE.md`](ARCHITECTURE.md) defines the stable dependency boundaries and renderer-portability constraints.
- [`roadmap.md`](roadmap.md) indexes the remaining improvements and their focused documents.

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
