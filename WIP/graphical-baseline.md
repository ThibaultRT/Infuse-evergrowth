# Graphical baseline procedure

This file records the reproducible baseline for graphical delivery slice 1. Keep results here when validating a release so later slices can be compared on the same terms.

## Viewport matrix

| Profile | CSS viewport | Purpose |
| --- | ---: | --- |
| iPhone 12 portrait | 390 × 844 | Minimum first-class phone reference |
| Large iPhone portrait | 430 × 932 | Larger current-phone adaptation |
| Tablet portrait | 820 × 1180 | Adapted tablet layout |
| Desktop | 1440 × 900 | Desktop adaptation |

For each profile, capture Area 1 and Area 2 in full resolution / smooth mode, then exercise reduced resolution and battery-saver mode. Screenshots used for visual comparisons should use full resolution.

## Measurement method

1. Run `npm run build` and record the compressed and uncompressed output printed by Vite.
2. Run `npm run dev -- --host 0.0.0.0`, open the settings wheel, and enable **Show renderer statistics**. This option exists only in development builds.
3. For each viewport and area, allow 10 seconds for warm-up, then record FPS, draw calls, triangles, geometries, textures, and drawing-buffer dimensions from the overlay during idle and dense combat.
4. In browser developer tools, disable cache and record the load-event time plus total transferred bytes over a representative network profile. Repeat three times and use the median.
5. Repeat the iPhone 12 measurements on physical or representative constrained hardware. Desktop emulation validates layout, not mobile GPU performance.

## Slice 1 recorded baseline

- Production build output and repository asset size are recorded in the pull request validation results.
- Scene performance values and initial-load timing are pending representative browser/device measurement; they must not be inferred from a headless or development desktop alone.
- No third-party graphical assets or runtime dependencies were introduced in this slice, so the asset-license inventory is unchanged.

## Acceptance targets

- Initial load: no more than 20 seconds under reasonable supported-network conditions.
- Downloadable payload: below 500 MB, while remaining materially smaller wherever practical.
- Full mode: device pixel ratio capped at 2.
- Reduced mode: 70% of device pixel ratio, still capped at 2.
- Battery-saver mode: 30 FPS target; smooth mode: up to 60 FPS.
