# Infuse: Evergrowth

An iOS-friendly active incremental RPG delivered as a Progressive Web App.

## v0.3 vertical slice

- Compact 3D map with 30 fixed targets across Crystal → Legendary tiers
- Low-poly human placeholders for combat enemies
- Human hero in starter underwear; equipment slots are represented in the HUD
- Central touch joystick for iPhone plus WASD / arrow keys on desktop
- Automatic combat: the hero attacks the nearest living target inside the current weapon range
- Bare hands use **Blunt** damage with a base value of **5**, shown with a hammer icon in the HUD and stats page
- Direct permanent-stat rewards: targets grant Max HP or Blunt Attack, not Essence
- Source-aware stats using `(base + additive sources) × multiplicative sources`
- Health regeneration starts at **0.10 HP/s** and is tracked like the other hero stats
- Decimal-precision stats tracking page with whole-number combat HUD
- Small floating HP bars above targets with no target names or numeric values
- Per-spawn escalating respawn timers with a local-midnight reset
- Local save for permanent stats and daily spawn state; during early development save migrations are intentionally not maintained
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
