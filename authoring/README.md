# World authoring workspace

The game world is authored as renderer-neutral TypeScript under `src/data/world/`.
Those layouts are the only source of placement transforms. The renderer and the
pure collision compiler consume the same named placements.

## Local development library

Run:

```bash
npm run authoring:assets:capture -- another-example
npm run authoring:assets:audit -- another-example
```

The capture command validates the prototype shape, preserves all public assets and
their relative dependencies, copies reference renders/source/provenance, backs up
the prior local Three.js Editor source, and writes SHA-256 plus byte size for every
captured file.

While the source folder exists, the audit verifies both capture integrity and exact
source parity. After `another-example/` is deliberately deleted, the same audit
continues to verify every preserved file against the captured SHA-256 inventory.

```text
authoring/local/world-development/
├─ source-assets/another-example-public-assets/
├─ references/
│  ├─ Layout.png
│  ├─ general-layout.png
│  ├─ iphone-preview.png
│  ├─ world-layout.glb
│  └─ prototype-source/
├─ provenance/
│  ├─ ASSET-LICENSES.md
│  └─ upstream-license-files/
├─ legacy-three-editor-source/
└─ inventory.json
```

`authoring/local/` is ignored by Git. Never flatten raw glTF trees or use this
directory from production code. Keep irreplaceable local creative sources backed up
outside the repository.

## Runtime promotion

`src/data/world/world-assets.json` maps semantic asset keys to captured sources or
already-tracked project assets and their normalized runtime filenames. Promote the
active catalog with:

```bash
npm run authoring:assets:promote -- --all
npm run authoring:assets:verify
```

Source `.gltf` dependency trees are repacked as self-contained GLBs. Only assets
referenced by accepted layouts belong under `public/assets/world/`; the generated
manifest records source/runtime hashes. Do not copy full packs into `public/`.
For a project-owned asset that is already under `public/`, use
`sourceRoot: "public"` with matching source and runtime paths. Promotion then
records and verifies the existing file without creating a duplicate.

## Preview, validation and debug GLB

```bash
npm run authoring:viewer
npm run authoring:world:validate
npm run authoring:world:capture
```

The browser preview uses the production `WorldBuilder` and
`WorldCollisionCompiler`. It provides chunk visibility, asset resolver switching,
stable-name search/picking, collider/spawn/gate-clearance overlays, camera presets,
statistics, and validation.

The capture command uses an installed Chromium browser to write:

```text
authoring/generated/captures/general-layout.png
authoring/generated/captures/iphone-12-area-a01.png
authoring/generated/captures/iphone-12-area-a02.png
authoring/generated/captures/iphone-12-area-a03.png
authoring/generated/debug/assembled-world-debug.glb
```

World validation remains human-led and manual-first. Browser smoke tests are tools for a human reviewer, not a requirement that an AI agent play the game live during world generation. Prefer deterministic validators, inspection, and manual playtesting over token-heavy live gameplay sessions.

The assembled GLB contains stable prop names and `COLLIDER_*` helpers. It is for
inspection in Three.js Editor or other glTF tools and never ships as the runtime
world. If `A03_Corner_SW` needs a 90-degree rotation, change that named entry in its
typed layout and regenerate; edits made inside the debug GLB do not round-trip.

Wall runs use physical `from`/`to` boundaries plus the unscaled GLB
`moduleLength`. The generator applies placement scale, derives the required count,
and aligns modules edge-to-edge; split runs can align directly to either side of a
gate while `startIndex` keeps stable sequential debug names. Area layouts may use
named `terrainCutouts` to lower overlapping terrain beneath a shared water surface
without changing the river or bridge elevation.

The A01/A02 woodland bridge has a semantic `walkSurface` profile and a hinged
`gate` definition in its prop catalog entry. Its one placement supplies rendering,
rail and door collision, and the floor used by hero/enemy movement. The 12 m deck
crosses the transition at Y=1.65; 3 m timber approaches descend to each bank.
The adjacent areas derive riverbed/landing terrain cutouts and scatter exclusions
from that transition. No mesh raycasts determine gameplay elevation.

`npm run authoring:world:validate` also checks two-way traversal at 30/60 Hz,
continuous elevation, rail containment, and the progression lock. Run
`npm run authoring:world:smoke-runtime -- --woodland-bridge` for keyboard-driven
portrait captures of the closed gate, opened gate, deck, and both landings.
The capture command also produces `woodland-bridge.png` and
`iphone-12-woodland-bridge.png` using the production builder.

## Greenhaven reference layout

Area A01 follows `Layout.png` within its unchanged 72 × 72 m playable footprint:
a northwest lake cove, west rock escarpment, southern canyon, fountain plaza,
branching stone lanes, a southern village loop, cottage gardens and pine clusters.
The west future exit remains closed by the existing world boundary. Its south exit
now crosses the Area 4 rift through the S2 rib-vault bridge and its bone/iron land gate.

`src/data/world/greenhaven.json` owns the lake/rock footprints, plateau dimensions,
roads, plaza, gardens and scenic bridge dimensions. The pure layout and the Blender
exporter consume this same data. Walkable village ground remains at Y=0; only
impassable lake/cliff ground drops below it. The woodland bridge continues to use
its existing independent floor profile and boss lock.

Rebuild the landscape and nine small asset exports with the installed Blender:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/world-assets/export-greenhaven.py
npm run authoring:assets:promote -- terrain.greenhaven village.rusticFence village.rusticFenceGate village.warmHomeA village.warmHomeB nature.greenhavenPineA nature.greenhavenPineB nature.greenhavenBoulder crossing.greenhavenFutureBridge
```

This saves an editable scene to `authoring/local/greenhaven/greenhaven.blend`.
The landscape uses three vertex-color batches, under 60k triangles / 5 MiB.
Warm-roof homes reuse the existing CC0 geometry and embedded recolored palettes.
Blender MCP was unavailable during this revision; the reproducible background
Blender exporter was used instead.

`authoring:world:validate` checks plateau height, all Area1 spawn/exit reachability,
scatter exclusions and the landscape export budget. `authoring:world:capture`
adds `area1-target-layout.png`. Run
`npm run authoring:world:smoke-runtime -- --greenhaven` to walk the village loop,
check the lake and future boundary, exercise persisted Full/Reduced and 30 FPS
settings, and verify playable loading fallback with the landscape request blocked.
`--greenhaven-shore` checks that the new pines and central fountain use the existing
occlusion fade to keep the followed hero visible.
These are desktop browser checks; a real iPhone performance pass remains necessary.

## Highwood reference layout

Area A02 follows the northern woodland in `Layout.png`: darker forest soil, more
leafless trees than pines, winding stone trails, timber lookouts, rocky northern
and western edges, and a broken stone riverbank. Its 144 × 48 m playable footprint,
world root, existing encounters, progression and both gate connections are retained.
`highwood.json` owns the terrain bounds, rock footprints and paths; `highwood.ts`
provides their pure collision and road values. The adjacent transitions own the
water and bridge approaches, including the cutouts in Area A02's visual apron.

Run `scripts/world-assets/export-highwood.py` through Blender MCP, setting `__file__`
to that script's absolute path. Background Blender can run the same script with
`--background --python`. It creates a separate scene and writes an editable local
copy without resetting the open file. Before the first export on a fresh checkout,
download the Quaternius source documented in `ASSET-LICENSES.md` to
`authoring/local/highwood/source/CygapExMf5.glb`; the exporter verifies its SHA-256.
The other source geometry comes from the tracked local KayKit/Kenney archives and
the already-promoted Greenhaven pines.

Promote with:

```bash
npm run authoring:assets:promote -- terrain.highwood nature.highwoodBareA nature.highwoodBareB nature.highwoodBareC nature.highwoodPineA nature.highwoodPineB wilds.timberWatchtower
```

The capture command adds `area2-target-layout.png` and
`iphone-12-highwood-trail.png`. `authoring:world:validate` checks all Area 2
encounters and route destinations remain reachable, walkable ground matches the
simulation floor, and the landscape stays within four draws / 45k triangles / 4 MiB.
`authoring:world:smoke-runtime -- --highwood` walks both crossings and the main trail,
captures portrait views, and checks persisted Reduced/30 FPS and missing-landscape
fallback. These browser checks do not replace real iPhone profiling.

## Fallen Keep reference layout

Area A03 follows the ruined castle in `Layout.png`: shattered ramparts on all four
sides, hollow corner towers, blue gatehouse banner remnants, a roofless keep and
chapel, small destroyed houses, a barracks, and connected stone courts. Its 72 × 72 m
playable footprint, root, existing gate connections and spawn IDs are retained.
A third gate now opens south to Area 4; both new rift crossings require its existing
boss victory. Walking remains at Y=0 away from the authored bridge approaches;
paving is a cosmetic surface dressing.

`src/data/world/fallen-keep.json` owns masonry dimensions, building wall segments,
roads, outer cliff dimensions and seven reserved encounter spots. The Blender
exporter and semantic collision proxies consume those same values. Building
interiors and entrances are open; ruined perimeter walls remain barriers.

The reserved spots are Gate Court, Ash Court, Chapel, Keep Hall, Smithy, Barracks
and East Court. Their stable `A03_Encounter_*` IDs, centers and clear radii can be
used by future spawn authoring; they do not create enemies or change saves.
The viewer's **Spawns / reserved spots** overlay shows turquoise clearance rings.

Run `scripts/world-assets/export-fallen-keep.py` through Blender MCP with its
absolute path as `__file__`. It creates an isolated scene and writes
`authoring/local/fallen-keep/fallen-keep.blend`. On a fresh checkout, download the
CC0 Castle Kit archive documented in `ASSET-LICENSES.md` to
`authoring/local/fallen-keep/source/kenney_castle-kit.zip` before exporting.
Run `scripts/world-assets/optimize-fallen-keep.ps1` after export for lossless
glTF Transform deduplication and pruning; it does not add runtime dependencies.
Promote the ten exports with:

```bash
npm run authoring:assets:promote -- terrain.fallenKeep ruin.curtainA ruin.curtainB ruin.cornerTower ruin.gate ruin.cottage ruin.barracks ruin.chapel ruin.keepHall ruin.siegeDebris
```

`authoring:world:validate` checks every existing encounter, building interior,
both gate approaches, the reserved clear radii and a 6 MiB / 85k unique triangle
asset budget. `authoring:world:capture` adds `area3-target-layout.png` and
`iphone-12-fallen-keep-court.png`. `authoring:world:smoke-runtime -- --fallen-keep`
walks both gates, the chapel and barracks, checks the south barrier, and exercises
saved Reduced/30 FPS and missing-terrain fallback. These browser captures are not
a substitute for real iPhone performance measurements.

## Area 4 environment

`area4.md` is the construction plan and asset handoff brief. `Layout-area4.png` is
the all-area concept reference. Area 4 has flat charcoal/ash ground with blended
paths, a deep dark 12 m rift, the approved S2/W2 bridge models, the supplied 5.4 m
throne, charred tree markers and three impassable crusted lava basins. It has no
enemies or rewards yet.

`area4-blockout.json` owns dimensions, and the two transition placements own their
rendering, rails, locks and floor profiles. Each bridge is a separate GLB from its
gate: S2 has a bone/iron land gate at Z=27; W2's doors are part of the existing
masonry gateway at Z=30. The two gate placements own the locks and reuse the
named-hinge runtime. `area4-bridges.json` adds shared gate dimensions and hinge
offsets; semantic blockouts remain the loading fallback. Both 84 × 12 m transitions span world Z=30..42,
with the 12 m decks centered on the unchanged seam at Z=36. Their 3 m approaches
reach dry land at Z=27 and Z=45. Collision and floor profiles are compiled into
both adjacent areas, as for A01/A02. Area roots, connection IDs and save v18 stay fixed.

The rift reaches 6 m into Areas 1 and 3. All overlapping terrain uses its shared
cutout, including the A01/A03 apron. The A03 south wall/gate sits at Z=30, with
shorter east/west runs and relocated corner joins; its enclosure fits without an
area extension. The southern roads/scatter and both landscape exports meet the
new bank. A01's old canyon water and scenic bridge remain retired.

Slice 4 replaces the northern landscapes' shallow south cliff rocks with
transition-owned fractured banks. Shared `riftBanks` keep their roots local and
their world X=36 join continuous. Open terrain cutouts remove the underlying
surface; bank faces fade to black by Y=-14, above an unlit black closure at Y=-48.
The abyss ignores light, exposure and sky fog. The walkable land stays at Y=0.
`Area4TerrainView.ts` builds the ash grain, flat routes and small lava crusts
without an asset request, so the terrain remains available during loading failure.
The three lava placements retain their original semantic circle footprints.

Use `npm run authoring:world:capture -- --area4-terrain` for six focused captures:
terrain, continuous banks, portrait abyss depth, lava and both bridge landings.
The viewer includes matching bank, depth and lava presets. The world validator
also checks missing rift surfaces, dark depth, shared bank endpoints, flat ground,
lava containment and a 21k triangle budget (currently about 18.5k plus one 256px
generated texture). Runtime `--area4` smoke also walks into the lava boundary.

To rebuild just the affected landscapes, preserving other runtime models and the
previous full local creative scenes, run:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/world-assets/export-greenhaven.py -- --landscape-only
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/world-assets/export-fallen-keep.py -- --landscape-only
```

Both exporters read the shared rift dimensions and save separate `*-landscape.blend`
sources under their local directories. Apply glTF Transform dedup/prune to the two
landscape GLBs, then run `npm run authoring:assets:promote -- terrain.greenhaven terrain.fallenKeep`.

`authoring:world:capture` includes the 3840 × 3200 `world-layout-area4-hires.png`, `area4-blockout.png`,
`iphone-12-area-a04.png` and both portrait rift bridges. The assembled debug GLB
now contains nine chunks. Run `authoring:world:smoke-runtime -- --area4` to walk
both bridges each way in Full and persisted Reduced/30 FPS, verify the lock and old
boss-victory backfill, and inspect both sides of the seam, landings and missing-world-assets
traversal. World validation checks the Z=30..42 barrier in all three areas, continuous
Z=27..45 floors and the complete A03 perimeter, including its moved corner joins.

Rebuild the four S2/W2 models in an isolated Blender scene, optimize with an
existing glTF Transform installation, then refresh their manifest entries:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --python scripts/world-assets/export-area4-bridges.py
node scripts/world-assets/optimize-area4-bridges.mjs --tool-root '<gltf-transform installation root>'
npm run authoring:assets:promote -- crossing.area4SkeletalBridge crossing.area4BoneGate crossing.area4TimberBridge ruin.area4SouthGate
```

The editable source and build reports are under `authoring/local/area4/models/`.
The four vertex-colored GLBs total 2.09 MiB with no texture or decoder dependencies.
The S2 rib vault has a separate occlusion group so fading its overhead bones does
not fade the walking deck. W2 reuses the shipped masonry unchanged.
Run `node scripts/world-authoring/validate-area4-bridges.mjs` for focused asset,
hinge, floor and lock checks, and `npm run authoring:world:capture -- --area4-bridges`
for six bridge/gate captures without the full world export.

The user-supplied `Throne-area4.glb` is preserved as
`authoring/local/area4/throne/Throne-area4-source.glb`. Reproduce its runtime export:

```powershell
node scripts/world-assets/prepare-area4-throne.mjs --tool-root '<gltf-transform installation root>'
npm run authoring:assets:promote -- ruin.ancientThrone
npm run authoring:world:capture -- --area4-throne
```

The exporter checks the original hash, simplifies to 14,900 triangles, retains all
three original 1K textures, and bakes uniform scale to the shared 5.4 m height.
The 0.90 MiB GLB has a ground-centred local root and faces -Z. Its 4.887 × 3.657 m
visual extent fits the revised 4.9 × 3.7 m authored footprint. The unchanged
`A04_Ancient_Throne` placement supplies collision and occlusion; the previous
semantic throne remains a loading fallback. No gameplay interaction is added.
The throne capture option writes `area4-throne.png` and
`iphone-12-area4-throne.png` using the production world builder.

## Ownership

- `src/data/world/**`: authoritative dimensions, layouts, prop catalog and asset map.
- `src/domain/world/**`: pure transforms, collision values/math/compiler.
- `src/rendering/environment/**`: assets, materials, geometry, builder and providers.
- `authoring/local/**`: ignored raw/reference material; never rewritten by the builder.
- `authoring/generated/**`: ignored reproducible captures and debug output.
- `public/assets/world/**`: tracked curated runtime assets only.

See `three-editor.md` for the spatial and inspection contract and
`ASSET-LICENSES.md` for shipped provenance.
