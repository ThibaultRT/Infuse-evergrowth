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
bridge and gate. Area A03 owns the east and south wall runs. The A03/A04 transition
owns `A03_SouthGate` at local `(14,0,-6)`, world `(86,0,30)`, plus the separate W2
timber bridge. The south wall and both southern corner joins meet the rift's
north edge at Z=30; the east/west curtain runs end at those corners. Broken-looking
wall pieces remain collidable; only the three authored
gates are traversable. Each Area 4 gate owns its connection's single lock proxy.

Area A04 has flat charcoal/ash terrain, blended paths and three small lava basins.
Its eastern boundary at world X=108 uses four supplied fence modules around
`A04_East_Gate` at `(108,0,71.4)`. The gate is a closed scenic boundary with no new
progression rule. `A04_South_Lava_Transition` belongs to A04 and covers world
X=-42..114, Z=82..90, including the full south playable edge. Its single named
placement supplies the lake mesh and semantic rectangle; the ash ground terminates
at its north edge. This environmental transition requires no additional area or
connection chunk. `area4-boundaries.json` owns dimensions and `area4Boundaries.ts`
owns placements; supplied models are normalized in Blender and retain fallbacks.
Six reusable forest assets dress the area with deterministic, spaced trunks,
stumps, logs and basalt. Shared `area4-forest.json` dimensions drive their semantic
footprints and visual clearances; model failures retain simple visible fallbacks.
Two dense groves each use one circular semantic footprint and twenty local visual
tree children. Their named parent placements own the transform, and the surrounding
scatter excludes their branch overhang. Children retain individual occlusion fades.
Both rift transitions
follow the A01/A02 convention: world Z=30..42, centered on the unchanged seam at Z=36. The rift
extends 6 m into Areas A01/A03 and 6 m into A04. Each 3.4 m-wide bridge has a 12 m
deck at Y=0.6 centered on the seam and 3 m approaches reaching Y=0 at Z=27 and Z=45.
Transition collision and walk surfaces are shared with both adjacent areas, so
ownership changes at midspan without a height jump. All area roots and footprints
stay fixed. A04's solid ground begins at Z=42. Their world X values
are 7.2 (A01) and 86 (A03). Both require the Area A03 boss victory, including victories
already recorded in supported saves. Overlapping terrain, including the A01/A03
apron, yields to the same rift cutout; the two northern landscape GLBs follow its
north bank. S2's separate bone/iron gate stands on Area 1 land at world `(7.2,0,27)`.
W2's timber doors hinge on the existing masonry's inland face at world Z=29.3.
Both open inland with 3.4 m clearance, using the existing connection state.
`area4-blockout.json` owns the floor dimensions and `area4-bridges.json` owns gate
details shared by the Blender exporter and semantic collision;
`area4.md` describes the final asset handoff and remaining decisions.

Open rift cutouts omit the overlapping terrain surface entirely, including the
A01/A03 apron. Transition-local `riftBanks` derive fractured lips from the shared
world-space profile, meet at X=36 and leave the bridge landings clear. Rock faces
fade to black by Y=-14 and end at an unlit black closure at Y=-48. Neither lighting
nor sky fog reveals a floor. The two landscape GLBs no longer contain shallow
southern cliff shelves. All walkable ground remains Y=0. Lava basin geometry stays
within its named prop's unit circle, scaled by the shared pool radius for both
rendering and collision. No gameplay heights are read from this geometry.

`A04_Ancient_Throne` uses the supplied throne GLB at local `(0,0,15)`, world
`(36,0,75)`. Uniform scale is baked into the mesh: height 5.4 m, ground Y=0,
root scale 1 and front -Z. Its natural proportions occupy 4.887 × 3.657 m;
the shared spec reserves a 4.9 × 3.7 m collision footprint, including the lava
apron. The model and fallback both use that same placement and occlusion tag.

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
