# Area 4 — burned forest

## Current state and next decisions

Area 4 is an environment-only region south of Areas 1 and 3. The flat ash terrain,
rift and two bridges, gates, supplied throne, charred forest, eastern fence/gate,
and southern lava shore are integrated. It has no encounters, boss, loot, lava damage,
falling, bridge collapse, particles, or throne interaction. The unused enemy affinity
header is provisional until encounters are designed.

The initial scattered dressing passed the user's movement review. The two dense
groves still need the user's manual movement and visibility review. Real-device load
time, memory, and frame rate remain unmeasured. Those are the next environment
acceptance inputs; gameplay content is a later, separate design request.

For a new major asset, the user supplies a 2D reference or 3D source first. Adapt
that source to the fit contract below. Keep design, asset fitting, implementation,
and manual playtesting as separate requests under `AGENTS.md`.

## Art direction

The working name is **Area 4 / Burned Forest**. [Four-area concept](Layout-area4.png)
is an art reference. [World overview](Layout-area4-blockout-hires.png) shows the
actual four-area blockout, not final art. Preserve the existing village, northern
forest, ruined citadel, and their connections. Area 4 has scorched forest, ash
clearings, isolated lava pools, and one ruined stone throne suggesting an older
species without identifying it. The old `Layout.png` “West Gate to Area 4” label is
superseded; the west exit stays closed.

## Spatial and gameplay contract

1 unit = 1 metre; +X east, -Z north, +Y up. Areas 1–3 retain their roots and bounds.

| Element | World placement / dimensions |
| --- | --- |
| Area 1 | Root `(0,0,0)`; playable 72 × 72 m |
| Area 2 | Root `(36,0,-60)`; playable 144 × 48 m |
| Area 3 | Root `(72,0,0)`; playable 72 × 72 m |
| Area 4 | Root `(36,0,60)`; playable 144 × 48 m, X `-36..108`, Z `36..84`; visual 156 × 60 m |
| Both transition chunks | Visual 84 × 12 m; world Z `30..42`; ownership seam Z `36` |
| Rift | 12 m span; banks fade to black by Y `-14`, unlit closure at Y `-48` |
| Crossings | X `7.2` from Area 1 and X `86` from Area 3; separate bridges and gates |
| Bridge walk profiles | 3.4 m clear deck, Z `30..42` at Y `0.6`; 3 m approaches to Y `0` at Z `27` and `45` |
| S2 land gate | `(7.2,0,27)` before the north ramp; separate bone/iron module |
| Area 3 south wall/gate | `(86,0,30)` at the rift bank; masonry wall joins and inland-opening doors |
| Throne | A04 local `(0,0,15)`, world `(36,0,75)`; 5.4 m tall, 4.9 × 3.7 m blocked footprint, faces -Z |
| Eastern boundary | Fence at X `108`; closed 8 m gate at `(108,0,71.4)` |
| Southern lake | X `-42..114`, Z `82..90`; blocks the full south playable edge and corners |

Both transition chunks share compiled collision and walk surfaces with their adjacent
areas, so the hero stays at Y `0.6` across the Z=36 ownership seam. The rift occupies
6 m of the northern areas and 6 m of Area 4. Ground elsewhere stays at Y=0.
Overlapping northern terrain uses the shared open rift cutout. The two bank profiles
join at X=36 and flatten around bridge lanes. The A03 south wall joins the rift's
north edge at Z=30. Area 4 does not exceed the combined width of Areas 1 and 3.

Defeating Area 3 boss `area3-epic-01` opens both gates, including for supported saves
with that victory already recorded. Area 4 has `bossSpawnId: null` and no spawns.
The existing area list and current-area save fields represent this extension; save
v18 and its storage key remain unchanged. Lava pools and the southern lake are
impassable through authored collision, with no damage mechanic. The eastern gate
stays closed until a destination is designed.

`src/data/world/area4-blockout.json` owns dimensions. Named placements in
`areaA04Layout.ts`, `area4RiftTransition.ts`, and `area4Boundaries.ts` own transforms;
their shared renderer-neutral specs generate collision and rendering placement.
Never copy transforms into parallel collision lists or derive walkability from GLBs.

## Asset fit contract

The approved S2 rib-vault bridge, bone/iron land gate, W2 scorched timber bridge,
Area 3 masonry gate, and user-supplied throne are already integrated. Retain their
named placements and semantic fallbacks. S2's overhead bones fade separately from
its deck. W2's cosmetic damage and sag leave a continuous supported route. Gate
leaves open inland and clear the full 3.4 m lane. The throne's supplied proportions
are uniformly scaled to 5.4 m; its lava apron is cosmetic.

For a replacement asset, request a user-made reference/source and specify the
required dimensions, front/side/top and game-camera views, and 1.8 m human scale
reference. Deliver an editable `.blend` or equivalent and optimized self-contained
`.glb`: metres, +Y up, ground-centred local pivot, applied transforms, runtime scale
1, and named materials. Provide triangle/material counts, texture sizes, byte size,
source/license record, and any meaningful occlusion nodes. Bridge pivots sit at
midspan X/Z; geometry follows the authored floor profile. The shared semantic
footprint/floor spec remains gameplay authority. Preserve a playable fallback.

Provisional targets pending device profiling: each bridge ≤30k triangles, ≤3
materials, ≤3 MiB; throne ≤15k triangles, ≤2 materials, ≤2 MiB. Prefer reused 1K
textures. Raw sources belong in ignored `authoring/local/area4/` and need a backup
outside Git; accepted runtime assets are promoted through `world-assets.json` and
recorded in `ASSET-LICENSES.md`.

## Review handoff

Run the relevant deterministic validator and focused static capture from
[authoring/README.md](authoring/README.md) for a changed asset or layout. Run full
world/release checks when an implementation slice is ready for acceptance. Do not
run AI-controlled live gameplay trials.

For the pending human review: walk around both groves and confirm their interiors
are blocked; follow both bridge paths to the throne; check trunk fading in Full and
Reduced/30 FPS; revisit Area 4 offline. Record any visibility or movement issue.
Profile load time, memory, and frame rate on an iPhone 12-class device before
accepting the environment performance target. Static captures and browser emulation
do not establish real-device performance.

Later, design encounters, affinity, boss, rewards, and any throne interaction as a
separate content pass. Stable spawn IDs and authored HP/damage/rewards belong in
`src/data/areas/area-4.json`; any new save shape needs full versioned migration.
