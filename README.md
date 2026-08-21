# Infuse: Evergrowth

An iOS-friendly active incremental RPG delivered as a Progressive Web App.

## v0.31 vertical slice

- Compact 3D map with 30 fixed targets across Crystal → Legendary tiers
- Low-poly human placeholders for combat enemies
- Human hero in starter underwear
- Hero starts at **20 Max HP**, **5 Blunt Attack**, and **0.10 HP/s** passive regeneration
- Central touch joystick for iPhone plus WASD / arrow keys on desktop
- Automatic combat: the hero attacks the nearest living target inside the current weapon range
- Bare hands use **Blunt** damage with a base value of **5**, shown with a hammer icon
- Targets advertise their current stat loot above the HP bar using only a value + icon
- Loot is rolled once per target life: Max HP uses a heart icon, Blunt Attack uses a hammer icon
- Stat gains from kills appear on the right as number + icon only; new gains spawn at a fixed origin and push older gains upward
- Hero attacks show a small floating damage value + hammer icon over the target
- Enemy hits show a red negative damage value + hammer icon over the hero; all enemies currently deal Blunt damage
- Fully defeated Common/Uncommon packs show a circular countdown until the first member respawns
- Direct permanent-stat rewards: targets grant Max HP or Blunt Attack, not Essence
- Source-aware stats using `(base + additive sources) × multiplicative sources`
- Decimal-precision stats tracking page with whole-number combat HUD
- Four equipment slots are shown side by side in a bottom dock, with a dedicated Inventory window ready for future equipment
- Per-spawn escalating respawn timers with a local-midnight reset
- Local save for permanent stats, inventory state, loot rolls, and daily spawn state; during early development save migrations are intentionally not maintained
- Installable PWA shell deployed through GitHub Pages

## Current damage types

| Type | Current source | Base attack |
| --- | --- | ---: |
| Blunt | Bare hands | 5 |

The damage-type model is designed to accept additional weapon/damage types later without collapsing them into one generic Attack stat.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The Vite base path is currently configured for GitHub Pages at `/Infuse-evergrowth/`.

## GitHub Pages

A workflow in `.github/workflows/deploy-pages.yml` builds and deploys `dist/` on pushes to `main`.

If Pages is not enabled yet, select **GitHub Actions** as the Pages source in the repository settings.
