# Infuse: Evergrowth

An iOS-friendly active incremental RPG delivered as a Progressive Web App.

## v0.1 vertical slice

- Compact 3D map
- 30 fixed targets across Crystal → Legendary tiers
- Low-poly human placeholders for combat enemies
- Human hero in starter underwear; equipment slots are represented in the HUD
- Touch controls for iPhone plus WASD/Space on desktop
- Direct permanent-stat rewards: targets grant Max HP or Attack, not Essence
- Decimal-precision stats tracking page with whole-number combat HUD
- Per-spawn escalating respawn timers with a local-midnight reset
- Local save for permanent stats and daily spawn state
- Installable PWA shell prepared for GitHub Pages

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
