# Three.js Editor / Gaea world-authoring quick start

Use this guide when replacing the current procedural/blockout environments with authored Gaea + Three.js Editor scenes.

The important rule is: **author each area around its own local origin and let Infuse place the exported root in world space.** Do not bake the global world offset into an area's GLB.

These dimensions/origins are production-authoring targets inferred from the accepted world visualization and the current area proportions. Area 1 is the agreed anchor. Area 2/3 values are intentionally marked as target estimates until their production scenes are validated in-game.

## Coordinate convention

Infuse currently places Area 2 north of Area 1 at a negative Z world origin, so preserve the existing runtime convention:

- 1 Three.js/editor/Gaea unit = 1 meter.
- X = east/west ground axis.
- +X = east.
- Z = north/south ground axis.
- **-Z = north**, +Z = south.
- Y = elevation/up.
- Area roots use scale `(1, 1, 1)` and zero rotation.
- Keep a common Y datum across areas. Do not independently re-zero terrain vertically in a way that makes shared water/banks/walls jump at a seam.

The current runtime area origins are still the old blockout values. Do not treat them as the final production positions. When authored areas start replacing the blockouts, Codex should deliberately update the rendering/world-placement data to the targets below rather than silently trying to fit the new GLBs to the old dimensions.

## Target area sizes

Every area has a **playable envelope** plus a 6 m visual apron on each side. Therefore the visual envelope is 12 m larger than the playable envelope on each axis.

| Area | Theme / role | Playable target | Visual / Gaea target | Local playable bounds | Local visual bounds | Proposed world root |
| --- | --- | --- | --- | --- | --- | --- |
| Area 1 | meadow / hub | **72 × 72 m** | **84 × 84 m** | X `-36..36`, Z `-36..36` | X `-42..42`, Z `-42..42` | `(0, 0, 0)` |
| Area 2 | darker ashwood / river frontage | **84 × 72 m** | **96 × 84 m** | X `-42..42`, Z `-36..36` | X `-48..48`, Z `-42..42` | **target estimate** `(6, 0, -72)` |
| Area 3 | ruined fortress | **84 × 72 m** | **96 × 84 m** | X `-42..42`, Z `-36..36` | X `-48..48`, Z `-42..42` | **target estimate** `(78, 0, 0)` |

### Why 84 × 72 for Areas 2 and 3?

Area 1 is intentionally growing from the current 36 × 56 blockout to 72 × 72.

The accepted visualization depicts Area 2 as broader east/west than Area 1 but with a similar north/south travel depth. The current authored data already reflects this: Area 2 is 76 × 56. A clean **84 × 72** target keeps that character while giving the new terrain more room.

Area 3 currently measures 40 × 56, close to Area 1's old 36 × 56 footprint. Scaling it by roughly the same amount as the new Area 1 gives about 80 × 72; **84 × 72** is a clean editor-friendly target and gives the ruined fortress slightly more lateral room than Area 1.

Do not increase these further just to fill the concept image. Start here, inspect the portrait camera and gameplay density, and only enlarge before production detailing if the real scene proves cramped.

## Proposed world layout

The proposed roots preserve the current triangular topology while making the new rectangles meet exactly at their playable seams.

```text
                         NORTH (-Z)

              Area 2 — 84 × 72
          root (6, 0, -72)
          playable X -36..48
          playable Z -108..-36
                  │
                  │ river seam at Z = -36
                  │
 Area 1 — 72 × 72 ├──────────── small A2/A3 shared corner/gate
 root (0, 0, 0)   │
 X -36..36        │
 Z -36..36        │ Area 3 — 84 × 72
                  │ root (78, 0, 0)
                  │ playable X 36..120
                  │ playable Z -36..36
                         EAST (+X)
```

This produces these world-space envelopes:

| Area | Playable X | Playable Z | Visual X | Visual Z |
| --- | ---: | ---: | ---: | ---: |
| Area 1 | `-36..36` | `-36..36` | `-42..42` | `-42..42` |
| Area 2 | `-36..48` | `-108..-36` | `-42..54` | `-114..-30` |
| Area 3 | `36..120` | `-36..36` | `30..126` | `-42..42` |

The visual envelopes overlap; the playable envelopes meet at their intended seams. **Do not add another 12 m gap between areas.** The 12 m transition band is the overlap created by the two 6 m visual aprons.

## Shared transition bands

Transitions are shared presentation chunks, not duplicated scenery baked independently into both neighboring area GLBs.

Canonical naming rule:

```text
Transition_A<lower-id>_A<higher-id>_<Theme>
```

Always sort the area IDs. Do not use a directional `A01_to_A02` name because the same transition is viewed and crossed in both directions.

Suggested file names use the same identity in kebab case, for example:

```text
transition-a01-a02-river.glb
transition-a01-a03-ruined-wall.glb
```

### Area 1 ↔ Area 2 — river

Canonical root:

```text
Transition_A01_A02_River
```

The playable seam is:

```text
world Z = -36
```

The visual overlap is exactly:

```text
world X = -42..42
world Z = -42..-30
```

So the nominal shared river band is **84 m long × 12 m deep**.

A convenient transition-root placement is:

```text
world position = (0, 0, -36)
```

and the transition can be authored locally around:

```text
X = -42..42
Z = -6..6
```

The river does not need to be a perfectly straight 12 m rectangle. The 12 m is the guaranteed overlap budget. Banks, coves, rocks and waterfalls can extend visually where composition requires it.

The transition chunk should own scenery that would otherwise be duplicated across both area exports, especially:

- shared water surface;
- bridge/causeway crossing the seam;
- seam rocks and river props;
- cross-boundary effects or vegetation that must match from both sides.

Area 1 and Area 2 terrain may each form their respective banks, but do not bake two competing copies of the same river water/bridge into both GLBs.

### Area 1 ↔ Area 3 — ruined wall

Canonical root:

```text
Transition_A01_A03_RuinedWall
```

The playable seam is:

```text
world X = 36
```

The visual overlap is:

```text
world X = 30..42
world Z = -42..42
```

So the nominal shared ruined-wall band is **12 m deep × 84 m long**.

A convenient transition-root placement is:

```text
world position = (36, 0, 0)
```

and its local authoring envelope can begin around:

```text
X = -6..6
Z = -42..42
```

This chunk should own the gate/wall/rubble geometry that must line up from both Area 1 and Area 3. The neighboring area scenes should blend into it rather than each containing a duplicate wall.

### Area 2 ↔ Area 3

The existing game also has an Area 2 ↔ Area 3 connection. With the target rectangles above, their visual envelopes naturally overlap around the southeast corner of Area 2 / northwest corner of Area 3:

```text
world X = 30..54
world Z = -42..-30
```

That is sufficient room for the existing gate/transition concept. Do not lock a production theme/name for this shared chunk until Area 2 and Area 3 are authored; use the current `connections.json` gameplay connection as authority in the meantime.

When the art direction is chosen, use the same canonical form:

```text
Transition_A02_A03_<Theme>
```

## How to author each area in Three.js Editor

Use one production editor scene/project per area.

Example Area 1 hierarchy:

```text
Area_A01_Root                position 0,0,0 / rotation 0 / scale 1
├─ Terrain
├─ Vegetation
├─ Rocks
├─ Structures
├─ Props
├─ REF_Playable_72x72       editor guide only — do not ship
└─ REF_Visual_84x84         editor guide only — do not ship
```

Area 2 and Area 3 follow the same pattern with their own reference dimensions.

**Never position `Area_A02_Root` at `(6, 0, -72)` inside its production editor scene.** Its production export root stays at `(0, 0, 0)`. `(6, 0, -72)` is the world placement applied by Infuse or by the preview scene.

This keeps every GLB self-contained and makes re-exporting safe.

## Gaea handoff

Start terrain exports at the **visual** size, not only the playable size:

```text
Area 1 terrain: 84 × 84 m
Area 2 terrain: 96 × 84 m
Area 3 terrain: 96 × 84 m
```

Keep 1 unit = 1 meter and center the exported terrain around the area's local X/Z origin.

Use terrain geometry for broad silhouette/elevation. Do not spend extreme vertex density on tiny erosion/cracks that can be carried by normal/color textures.

For shared water elevations or other cross-area height references, use one common world Y datum. If a Gaea export arrives vertically offset, move the terrain mesh **inside the local area root** to restore the shared datum rather than giving every area an arbitrary root Y offset.

## World-preview scene for seam checks

Maintain a separate, disposable Three.js Editor preview scene. Import the independently exported GLBs and place them at their proposed world transforms:

```text
Area_A01_Root                  (0, 0, 0)
Area_A02_Root                  (6, 0, -72)
Area_A03_Root                  (78, 0, 0)
Transition_A01_A02_River       (0, 0, -36)
Transition_A01_A03_RuinedWall  (36, 0, 0)
```

Use this preview to inspect:

- terrain height continuity;
- river bank alignment;
- bridge/gate alignment;
- wall/rubble seams;
- visible gaps from the actual game camera direction;
- duplicate geometry / z-fighting;
- whether the 6 m apron is sufficient.

**Never export the combined world-preview scene as a production area GLB.** Areas and transition chunks remain independently exportable/loadable.

## Export checklist

Before every GLB export:

1. Confirm the production root is at `(0, 0, 0)`.
2. Root rotation is zero and root scale is `(1, 1, 1)`.
3. Confirm 1 unit = 1 meter.
4. Confirm terrain/props are centered around the intended local origin.
5. Remove or exclude all `REF_*` guides.
6. Do not include neighboring area GLBs in the export.
7. Do not duplicate shared transition water/walls/gates.
8. Export the area/transition independently to GLB.
9. Re-import it into the World Preview at the documented world transform and inspect the seams.
10. Optimize shipping assets after editor export; the raw editor export is not automatically the final runtime asset.

## Runtime implications for later Codex work

When production visuals begin replacing blockouts, the rendering layer should use explicit per-area visual metadata rather than assuming every area is 72 × 72 or deriving positions from GLB contents.

At minimum the rendering side will need stable values equivalent to:

```text
area id
world root position
playable width/depth
visual width/depth
visual provider / GLB URL
shared transition IDs
```

The GLB itself remains local around `(0, 0, 0)`.

Transitions should be independently loadable and should remain resident whenever their connection needs to be visible — for example while either neighboring area is current/nearby or while the hero approaches the gate. This fits the area-streaming work in `5-area-streaming.md`.

Gameplay JSON remains authoritative for collisions, spawns, gates and progression. Do not infer gameplay geometry from the editor scene. When production area dimensions/origins are accepted, update the authored gameplay/world data intentionally so gameplay coordinates and the rendering manifest describe the same world.

## Quick reference

```text
Axes:       +X east, -Z north, +Y up
Units:      1 unit = 1 meter
Apron:      6 m per visual side

Area 1:     playable 72×72, visual 84×84, root world (0,0,0)
Area 2:     playable 84×72, visual 96×84, root target (6,0,-72)
Area 3:     playable 84×72, visual 96×84, root target (78,0,0)

A1/A2:      Transition_A01_A02_River
             seam Z=-36, nominal overlap 84×12

A1/A3:      Transition_A01_A03_RuinedWall
             seam X=36, nominal overlap 12×84

Production GLB root: ALWAYS local (0,0,0)
World offset:          applied by Infuse / preview scene
```
