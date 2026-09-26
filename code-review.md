# Code review

Top ten improvements, ordered by impact. Preserve the existing domain/system/runtime architecture.

1. **Infused speed does not reach gameplay** — `src/game/GameSession.ts` omits `minionInfused` from `syncStats` subscriptions. An isolated check increased calculated speed from 7.69 to 13.88 while movement stayed at 7.69. **Fix:** synchronize stats on infusion and add a regression check.

   **Done:** `minionInfused` now synchronizes runtime stats. A regression sacrifices a minion with earned speed and verifies actual hero displacement uses the new speed immediately.

2. **CI skips existing safety checks** — `.github/workflows/deploy-pages.yml` only runs the build; regression, minion and release validators are omitted. `tools/world-authoring-viewer` also falls outside `tsconfig.json`. **Fix:** expose one check command, run it in CI, and type-check the viewer.

   **Done:** `npm run check` runs the production build, both regression suites, minion gameplay/assets checks, and full world/release validation. CI uses this command and `npm ci`. The viewer and its Vite configuration are type-checked; fixed its optional encounter list, BoxHelper argument, and minion slot arguments, and added Node type definitions.

3. **Low frame rates slow gameplay** — `Game.ts` advances simulation only on rendered frames and caps `dt` at 50 ms. At 10 FPS, movement/combat advance at half speed while wall-clock deadlines continue. **Fix:** separate simulation steps from rendering, with bounded foreground catch-up.

   **Done:** Fixed 1/60-second simulation steps run before the rendering rate limit, with a configurable 250 ms foreground catch-up cap. Hidden time advances only deadlines on return, without offline combat. Regressions compare movement, attack counts, and regeneration at 10/30/60 FPS and check long stalls/background recovery.

4. **World assets outlive visual residency** — `WorldAssetLibrary.ts` retains every loaded model/texture; production `LayoutVisualProvider.ts` has no eviction hook. Unmounting chunks leaves shared asset resources cached. **Fix:** track asset users and evict unused resources under a measured memory budget.

   **Done:** Prefetches, in-flight builds, mounted chunks, and shared terrain materials now retain/release their assets. Provider eviction releases ownership; least-recently-used unused resources are disposed above a configurable 64 MiB cache budget. Buffer sizes and decoded texture dimensions/mipmaps supply estimated residency, shown in developer stats. Active resources remain protected even above budget; this is not a hard process-memory limit. Regressions cover shared users, eviction order, reloads, late loads, and teardown.

5. **Combat repeatedly processes the entire save** — `GameSession.ts` persists on damage and every second; `save.ts` serializes state and decodes/migrates the previous save each time. **Fix:** coalesce writes per simulation update, preserve critical flushes, and avoid re-migrating known-valid previous saves.

   **Done (approved policy):** Routine autosaves run at most once per 30 seconds. Purchases, equipment/Ascend, sacrifice/summon, resets, area changes, and boss unlocks retain immediate saves, coalesced at the end of a simulation update. Visibility loss/page exit flush dirty state. Failed writes remain pending; validated previous-save strings are cached without masking external-tab changes or corrupt-primary recovery. Existing combat-save assertions now verify deferred rewards and complete lifecycle flushes.

6. **HUD rebuilds unchanged content every frame** — `Game.ts:updateHud()` recalculates four attack profiles and replaces their HTML continuously. Drop popups also request the entire progression snapshot. **Fix:** refresh static stats through events, update changed values only, and use a focused drop projection.

   **Done:** `HudPresenter` coalesces relevant events into a focused stat projection and updates attack markup and HP display only when values change. Equipment drop notifications use the item's Ascend threshold directly, without constructing a progression snapshot. Regressions count projections and DOM writes across unchanged frames and progression events.

7. **Presentation modules have too many responsibilities** — `Game.ts` contains spawn/gate classes, combat labels, cinematics and HUD code; `ui.ts` builds every panel. **Fix:** extract presenters and feature panel modules, provide teardown, and keep `Game` focused on composition and update order.

   **Done:** Extracted spawn, gate, combat, boss, respawn, and HUD presenters; moved Stats, Inventory/details, Soul Catcher, and Minions rendering into feature modules, with separate UI elements and notifications. `Game.dispose()` and panel teardown cancel callbacks, remove listeners, dispose views/resources, and prevent pending confirmations from acting after unmount. Game now composes these modules and orders simulation/render updates.

8. **Persistence has import-time side effects** — `save.ts` combines storage, migrations, defaults and `save = loadSave()`. Importing `GameSession` reaches this singleton even when state is injected. **Fix:** separate persistence modules, move date helpers out, and load browser state explicitly during boot.

   **Done:** Split storage, repository, defaults, and migrations under `src/persistence/`; moved calendar helpers to `src/domain/time/`. `main.ts` explicitly loads and injects browser state; `save.ts` is only a compatibility export surface. No singleton save is created on import. A cold-import regression rejects any browser-storage access; supported save versions and the v20 schema remain unchanged.

9. **Names obscure module responsibilities** — Two different `HeroStats.ts` files coexist; world files mix `area4.ts`, `areaA04Layout.ts` and `area-4.json`. **Fix:** use responsibility-specific names such as `StatCurves`/`HeroStatProjection`, and standardize area filenames within their folders.

10. **Documentation contradicts shipped code** — `ARCHITECTURE.md` still describes the removed `unlockedEver`/paid-summon state; `0-gameplay-remarks.md` claims no regression suite; completed plans remain in the root. **Fix:** document current slot-based progression, link existing validators, and retire completed plans.

Issues **9 and 10 are deferred** at the user's request. Pre-existing naming/documentation edits are outside this fix pass.

Validation: production build and viewer type-check passed; existing regressions **34/34** and new fix regressions **13/13** passed; minion gameplay/assets and full world/release validation passed (99.61 MiB payload). Static 390×844 Full/Reduced and failed-model captures passed with minion residency/death/re-entry checks. The extracted HUD and all five panels were captured separately; panel remount/disposal checks passed without simulation updates or save writes. No live gameplay trials were performed. The memory estimate and timing checks do not replace profiling on a real mobile device.

Manual acceptance: confirm movement/combat at Smooth and 30 FPS; inspect HUD/panels and infusion speed; revisit previously loaded areas offline and background/reopen after earning progress; check frame rate and memory on an iPhone 12.
