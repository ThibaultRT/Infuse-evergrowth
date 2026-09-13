# Three.js Editor world inspection and spatial conventions

Three.js Editor is an optional inspection surface. The authoritative world is the
typed, renderer-neutral content under `src/data/world/`; collision is compiled from
the same transforms. Never treat an edited GLB or mesh bounds as gameplay authority.

## Coordinate contract

- 1 unit = 1 meter.
- +X is east, -Z is north, +Y is up.
- Area and transition layout positions are local to their declared world root.
- Runtime rendering applies the world root once.
- Prop scale is uniform and affects both the visual and every default collision
  proxy.

| Chunk | Playable | Visual | Local playable bounds | Local visual bounds | World root |
| --- | --- | --- | --- | --- | --- |
| Area A01 | 72 × 72 m | 84 × 84 m | X/Z `-36..36` | X/Z `-42..42` | `(0,0,0)` |
| Area A02 | 144 × 48 m | 156 × 60 m | X `-72..72`, Z `-24..24` | X `-78..78`, Z `-30..30` | `(36,0,-60)` |
| Area A03 | 72 × 72 m | 84 × 84 m | X/Z `-36..36` | X/Z `-42..42` | `(72,0,0)` |
| Area A04 | 144 × 48 m | 156 × 60 m | X `-72..72`, Z `-24..24` | X `-78..78`, Z `-30..30` | `(36,0,60)` |
| A01/A02 transition | — | 84 × 12 m | — | X `-42..42`, Z `-6..6` | `(0,0,-36)` |
| A01/A03 transition | — | 12 × 84 m | — | X `-6..6`, Z `-42..42` | `(36,0,0)` |
| A02/A03 transition | — | 84 × 12 m | — | X `-42..42`, Z `-6..6` | `(72,0,-36)` |
| A01/A04 transition | — | 84 × 12 m | — | X `-42..42`, Z `-6..6` | `(0,0,36)` |
| A03/A04 transition | — | 84 × 12 m | — | X `-42..42`, Z `-6..6` | `(72,0,36)` |

Area A02 spans the combined width of A01 and A03. Visual aprons overlap; there is no
additional empty gap between playable chunks.

The A01/A02 crossing uses the project-supplied woodland bridge. Its deck runs
from world Z=-30 to Z=-42 over the river, with 3 m approaches reaching dry land
at Z=-27 and Z=-45. The shared area boundary at Z=-36 lies at midspan; neither
area root moves. The semantic prop's floor profile raises actors to Y=1.65 and
lowers them at the banks, independently of visual loading. Its hinged doors keep
the existing Area A01 boss unlock requirement.

Area A03 is enclosed by a ruined wall with three gate openings. The A01/A03 transition owns its
west wall and gate. The A02/A03 fortified river transition owns its north wall,
bridge and gate. Area A03 owns the east and south walls and the new south gate at
local `(14,0,30)`. The south wall and both southern corner joins meet the rift's
north edge at Z=30; the east/west curtain runs end at those corners. Broken-looking
wall pieces remain collidable; only the three authored
gates are traversable. The A03/A04 transition owns the timber bridge and its lock.

Area A04 is an untextured burned-forest blockout. Both rift transitions follow the
A01/A02 convention: world Z=30..42, centered on the unchanged seam at Z=36. The rift
extends 6 m into Areas A01/A03 and 6 m into A04. Each 3.4 m-wide bridge has a 12 m
deck at Y=0.6 centered on the seam and 3 m approaches reaching Y=0 at Z=27 and Z=45.
Transition collision and walk surfaces are shared with both adjacent areas, so
ownership changes at midspan without a height jump. All area roots and footprints
stay fixed. A04's solid ground begins at Z=42. Their world X values
are 7.2 (A01) and 86 (A03). Both require the Area A03 boss victory, including victories
already recorded in supported saves. Overlapping terrain, including the A01/A03
apron, yields to the same rift cutout; the two northern landscape GLBs follow its
north bank. `area4-blockout.json` owns the dimensions;
`area4.md` describes the final asset handoff and remaining decisions.

Area A03's ruined masonry uses `fallen-keep.json` for both Blender dimensions and
semantic collision. Corner towers add a round footprint to the two wall arms.
Roofless house, chapel and keep shells have wall-segment proxies so their interiors
can be entered. Seven `A03_Encounter_*` clearings are reserved for later spawn
authoring; the viewer shows their radii with its spawn overlay. They are scenery
authoring metadata and do not create live enemies or persistent state.

## Daily editing loop

Run `npm run authoring:viewer`. The preview builds the real layouts with the real
production builder and compiler. Use it for ordinary composition, selection by
stable name, collision overlays, spawn clearance and portrait-camera checks.

The readable sources are:

```text
src/data/world/areas/areaA01Layout.ts
src/data/world/areas/areaA02Layout.ts
src/data/world/areas/areaA03Layout.ts
src/data/world/areas/areaA04Layout.ts
src/data/world/transitions/a01A02Transition.ts
src/data/world/transitions/a01A03Transition.ts
src/data/world/transitions/a02A03Transition.ts
src/data/world/transitions/area4RiftTransition.ts
src/data/world/WorldPropCatalog.ts
```

A normal detail request should identify a stable placement, for example:

> Rotate `A03_Corner_SW` by 90 degrees.

Change the named layout entry. Rendering and collision are regenerated from that one
transform; there is no coordinate copy in `area-*.json`.

## Assembled debug GLB

Run:

```bash
npm run authoring:world:build-debug
```

This writes `authoring/generated/debug/assembled-world-debug.glb` and verifies it by
reading it back. The file includes:

- all nine visual chunks in world context;
- stable area, transition and prop names;
- named `COLLIDER_*` helpers generated from compiled collision;
- spawn and gate-clearance helper groups;
- diagnostic extras for chunk, prop, asset and collision source.

Open this one GLB in Three.js Editor for hierarchy, occlusion, depth and difficult
3D inspection. It is intentionally one-way: make accepted changes in the typed
layout, then regenerate. Do not ship the assembled file and do not derive collision
from it.

## Runtime chunks

The runtime currently uses `LayoutVisualProvider` for all nine chunks and retains the
existing `WorldVisualStreamingManager`. Each built root stays local and the provider
applies the layout world root. `StreamedGlbVisualProvider` remains available if a
measured device profile later justifies baking an accepted chunk; a baked GLB may
replace presentation only, never layout/collision/gameplay authority.

## Asset policy

Raw prototype assets and references live in the ignored checksummed development
library described in `authoring/README.md`. Accepted semantic assets are promoted as
self-contained GLBs or exact texture files under `public/assets/world/shared/` and
listed in `public/assets/world/asset-manifest.json` plus `ASSET-LICENSES.md`.

## Validation

Before accepting a world change, run:

```bash
npm run authoring:assets:verify
npm run authoring:world:validate
npm run authoring:world:capture
npm run build
npm run validate:release
```

Validation covers the fixed spatial contract, stable names, asset promotion,
deterministic collision, spawn overlap, unlocked gate centerlines, locked barriers,
the complete non-gate Area A03 perimeter, both rift crossings, abyss containment,
and existing/new boss unlock persistence.
