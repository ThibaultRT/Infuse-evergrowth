# Infuse: Evergrowth — Agent Context

## Project overview

- This repository is an iOS-friendly, browser-based active incremental RPG/PWA built with TypeScript, Three.js, and Vite.
- The current vertical slice has two authored areas and automatic proximity combat. See `README.md` for player-facing behavior and `implementation.md` for the detailed game rules.
- There is no test runner configured. The required baseline check is `npm run build`, which runs `tsc --noEmit` and then the Vite production build.

## Common commands

```bash
npm install       # install dependencies
npm run dev       # start Vite's development server
npm run build     # type-check and create dist/
npm run preview   # serve the production build
```

The Vite production base is `/Infuse-evergrowth/` for GitHub Pages. Deployment is defined in `.github/workflows/deploy-pages.yml`.

## Source map

- `src/main.ts`: application entry point; loads global CSS, applies the package version, and starts the game.
- `src/game/Game.ts`: current gameplay runtime, including scene setup, entities, automatic combat, respawns, portals, HUD updates, and the animation loop.
- `src/ui.ts`: HUD/modal HTML, cached DOM references, toasts, stat rendering, and inventory rendering.
- `src/style.css` and `src/reward-popups.css`: application and reward-popup presentation.
- `src/data/balance.json`: source of tunable gameplay numbers. Prefer changing balance here instead of hard-coding numbers.
- `src/data/areas.json`: authored area origins, fixed spawn points/groups, bosses, and portals.
- `src/config.ts`: converts JSON data into typed runtime configuration and provides calculated enemy stats.
- `src/save.ts`: local-storage schema/loading, daily spawn state, permanent stats, loot rolls, and persistence.
- `src/types.ts`: shared gameplay and save-data types.
- `src/controllers/`: camera and input handling.
- `src/visuals.ts` and `src/icons.ts`: Three.js models/materials and inline UI icon markup.
- `src/version.ts`: reads the app version injected from `package.json`; `package.json` is the version source of truth.

## Gameplay/data conventions

- Distances in balance data are meters. Cooldowns in balance data are seconds; runtime respawn deadlines are milliseconds since epoch.
- Enemy HP and attack are derived from the Common baseline, area scaling, and tier multiplier in `src/config.ts`.
- Damage types are explicit (`DamageType`); the current hero and enemies use Blunt damage.
- Spawns have stable authored IDs. Respawn state is stored per spawn with `killsToday`, `defeatedAt`, `respawnAt`, and the rolled loot type.
- Daily spawn state resets at local midnight. Permanent player stats, boss progression, inventory, and unlocked areas persist.
- When changing the save shape, update the types, normalization/loading logic, save version, and storage key together. Existing malformed/old saves should fall back safely.
- UI is rendered as a template in `src/ui.ts`; add every interactively queried element to the exported `ui` object. HUD controls need `pointer-events: auto` because the HUD container itself ignores pointer events.
- World-attached labels are DOM elements projected from Three.js positions. Keep their visibility synchronized with entity life and the active area.

## Code style and workflow

- Use strict TypeScript and ES modules. Follow the existing compact style and explicit return types on exported functions.
- Never wrap imports in `try`/`catch`.
- Keep tunable numbers in `src/data/balance.json` and authored map layout in `src/data/areas.json`.
- Do not edit generated `dist/` output or dependency contents.
- Run `npm run build` after code changes. For visible web-app changes, also inspect the running app at a mobile-sized viewport and capture a screenshot when tooling permits.
- Before committing, review `git diff` and `git status`. Commit changes on the current branch.
