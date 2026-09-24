# Code review

Top ten improvements, ordered by impact. Preserve the existing domain/system/runtime architecture.

1. **Infused speed does not reach gameplay** — `src/game/GameSession.ts` omits `minionInfused` from `syncStats` subscriptions. An isolated check increased calculated speed from 7.69 to 13.88 while movement stayed at 7.69. **Fix:** synchronize stats on infusion and add a regression check.

2. **CI skips existing safety checks** — `.github/workflows/deploy-pages.yml` only runs the build; regression, minion and release validators are omitted. `tools/world-authoring-viewer` also falls outside `tsconfig.json`. **Fix:** expose one check command, run it in CI, and type-check the viewer.

3. **Low frame rates slow gameplay** — `Game.ts` advances simulation only on rendered frames and caps `dt` at 50 ms. At 10 FPS, movement/combat advance at half speed while wall-clock deadlines continue. **Fix:** separate simulation steps from rendering, with bounded foreground catch-up.

4. **World assets outlive visual residency** — `WorldAssetLibrary.ts` retains every loaded model/texture; production `LayoutVisualProvider.ts` has no eviction hook. Unmounting chunks leaves shared asset resources cached. **Fix:** track asset users and evict unused resources under a measured memory budget.

5. **Combat repeatedly processes the entire save** — `GameSession.ts` persists on damage and every second; `save.ts` serializes state and decodes/migrates the previous save each time. **Fix:** coalesce writes per simulation update, preserve critical flushes, and avoid re-migrating known-valid previous saves.

6. **HUD rebuilds unchanged content every frame** — `Game.ts:updateHud()` recalculates four attack profiles and replaces their HTML continuously. Drop popups also request the entire progression snapshot. **Fix:** refresh static stats through events, update changed values only, and use a focused drop projection.

7. **Presentation modules have too many responsibilities** — `Game.ts` contains spawn/gate classes, combat labels, cinematics and HUD code; `ui.ts` builds every panel. **Fix:** extract presenters and feature panel modules, provide teardown, and keep `Game` focused on composition and update order.

8. **Persistence has import-time side effects** — `save.ts` combines storage, migrations, defaults and `save = loadSave()`. Importing `GameSession` reaches this singleton even when state is injected. **Fix:** separate persistence modules, move date helpers out, and load browser state explicitly during boot.

9. **Names obscure module responsibilities** — Two different `HeroStats.ts` files coexist; world files mix `area4.ts`, `areaA04Layout.ts` and `area-4.json`. **Fix:** use responsibility-specific names such as `StatCurves`/`HeroStatProjection`, and standardize area filenames within their folders.

10. **Documentation contradicts shipped code** — `ARCHITECTURE.md` still describes the removed `unlockedEver`/paid-summon state; `0-gameplay-remarks.md` claims no regression suite; completed plans remain in the root. **Fix:** document current slot-based progression, link existing validators, and retire completed plans.

Validation: existing regression checks **34/34 passed**; minion validator passed; isolated infusion check reproduced item 1. Performance findings require device profiling.
