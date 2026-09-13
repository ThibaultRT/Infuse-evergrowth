# Area 4 — burned forest construction plan

## Direction

Area 4 occupies the south of the world, spanning Areas 1 and 3 in the same way
Area 2 spans their north. Its north edge is one continuous rift, crossed by two
distinct bridges from the existing areas' south gates. The old `Layout.png` label
“West Gate to Area 4” is superseded by this direction; the west exit stays closed.

[Four-area concept](Layout-area4.png) is an art reference. It preserves the existing
village, northern forest, ruined citadel and their three connections. Its new region
contains scorched forest, ash clearings, small isolated lava pools and one ruined
stone throne for a being about three times human size. The throne suggests an older
species without confirming its identity.

The concept tool returned **1374 × 1145** despite a higher-resolution refinement
request. [High-resolution world overview](Layout-area4-blockout-hires.png) is a
separate **3840 × 3200** render of the actual four-area layout, including the basic
Area 4 construction. It is a blockout reference; it does not depict final Area 4 art.

## Current construction slice

- [x] Register Area 4 and both south connections in the existing layout/runtime graph.
- [x] Use a flat, untextured ash playground with a lowered rift and two traversable
  bridge placeholders. Their materials/silhouettes distinguish iron from damaged timber.
- [x] Remove Area 1's scenic south bridge and canyon water; its existing cliff forms
  the northern rift bank. Open a gate in Area 3's south curtain wall.
- [x] Reserve the central clearing and throne approach. Place a 5.4 m throne blockout,
  twelve simple charred trees and three small lava pool markers.
- [x] Compile bridge floor profiles, rails, locks, rift barriers, throne and pool
  footprints from renderer-neutral authored values. Lava is impassable in this slice.
- [x] Add viewer cameras, portrait captures and deterministic traversal/save checks.

This slice adds no encounters, boss, loot, damage-over-time, falling, bridge collapse,
particles or final environment models. The concept depicts the intended art pass;
the runtime currently contains geometric placeholders. Area 4's unused enemy affinity
header is provisional until encounters are authored.

## Spatial contract

1 unit = 1 metre; +X east, -Z north, +Y up. Areas 1–3 keep their roots and dimensions.

| Element | World placement / dimensions |
| --- | --- |
| Area 1 | Root `(0,0,0)`; playable 72 × 72 m |
| Area 2 | Root `(36,0,-60)`; playable 144 × 48 m |
| Area 3 | Root `(72,0,0)`; playable 72 × 72 m |
| Area 4 | Root `(36,0,60)`; playable 144 × 48 m; visual 156 × 60 m |
| Area 4 playable bounds | X `-36..108`, Z `36..84` |
| Rift | World Z `36..48`; nominal 12 m span, floor Y `-10` |
| Solid Area 4 ground | Begins at world Z `48`; 36 m of playable depth remains south of the rift |
| Area 1 crossing | World X `7.2`; transition root `(0,0,36)` |
| Area 3 crossing | World X `86` (A03 local X `14`); transition root `(72,0,36)` |
| Both bridge decks | 3.4 m clear width, 12 m span at Y `0.6`, plus 3 m approaches at each end |
| Both complete walk profiles | World Z `33..51`; Y `0` at both landings |
| Area 3 south gate | A03 local `(14,0,35.5)`; existing ruined-gate module, scale 1 |
| Throne | A04 local `(0,0,15)`, world `(36,0,75)`; 3.6 × 3.6 m footprint, 5.4 m tall |

The area ownership seam is at the north bank, world Z `36`, rather than the bridge
midpoint. This keeps the existing continuous-area movement mechanism and does not
move the old areas. Crossing into Area 4 therefore happens as the actor enters the
rift span. The two transition chunks meet at world X `36`; they own separate halves
of the abyss. Existing northern cliff outcrops are retained as blockout scenery;
the next terrain pass must reconcile their exact silhouettes with the final bridges.

`src/data/world/area4-blockout.json` owns dimensions and reserved locations. Named
placements in `areaA04Layout.ts` and `area4RiftTransition.ts` own transforms. Never
copy those transforms into a second collision list or infer walkability from GLBs.

## Access and persistence

Working default: defeating Area 3's existing boss, `area3-epic-01`, opens both bridges.
Both connections require unlocked area ID `4`; neither gives an early shortcut past
Area 3 progression. Area 4 has `bossSpawnId: null` and no spawns.

Saved Area 3 victories also grant this newly authored access during normalization.
The same boss-to-connection rule serves live progression and loading. Existing
stats, equipment, soul progression, daily counts, deadlines and per-life rolls are
retained. The save shape and key stay at v18: the existing numeric area list and
current-area field already represent this content extension.

## Next implementation slices

1. **Confirm the blockout and asset dimensions.** Walk the southern loop, judge travel
   distance and portrait sightlines, then settle bridge span, clearance, height,
   throne scale and Area 4 depth before modeling. Expanding the area later is possible,
   but would require revisiting the routes and encounter spacing.
2. **Prepare the three major assets ahead of integration.** Produce separate forged
   skeletal bridge, ruined timber bridge and ancient throne models against the
   contracts below. Review renders beside a 1.8 m human reference. Hand over editable
   sources, optimized GLBs, dimensions, materials and provenance as one package.
3. **Build terrain and the rift banks.** Add ash/charcoal ground, jagged northern and
   southern lips, dark abyss depth, small lava basins and clear readable paths.
   Reconcile the old Greenhaven/Fallen Keep cliff geometry and A04 terrain cutouts.
   Keep Y=0 walkable ground and reserve the routes/clearings. Avoid a large lava river.
4. **Integrate the approved major assets.** Replace each placeholder presentation at
   its existing named placement. Retain semantic collision and authored walk profiles;
   update the shared spec first if a reviewed asset needs different dimensions.
   Verify both bridge landings, gate opening and throne occlusion with actual movement.
5. **Dress the burned forest.** Prepare a small set of scorched trunks, stumps, fallen
   logs and basalt rocks. Use restrained deterministic scatter with exclusions around
   paths, pools, gates, spawn spaces and the throne. Keep a playable visual fallback.
6. **Author gameplay in a separate content pass.** Agree encounters, affinities, boss,
   rewards and any throne interaction. Add stable spawn IDs and authored HP/damage/
   reward ranges in `src/data/areas/area-4.json`. Decide lava/fall rules before adding
   systems or save fields. Any new save shape needs full versioned migration.
7. **Polish and validate.** Add restrained ember/light effects only after profiling.
   Check Full/Reduced and Smooth/30 FPS, offline revisits, loading fallback and a real
   iPhone 12-class device before considering the environment finished.

## Major asset handoff

Preparing these assets in advance is recommended **after** the dimensions are
accepted. Rendering can then adopt them without redesigning traversal.

| Asset | Art brief | Required fit |
| --- | --- | --- |
| Forged skeletal bridge | Dark forged metal; rib/bone-inspired arches and structural details; readable from portrait camera | 3.4 m uninterrupted clear deck, 12 m level span, 3 m approach each end; local +Z along crossing; no ribs inside clearance |
| Ruined timber bridge | Predominantly weathered wood and ropes; broken outer boards/rails, dangling beams, visible strain | Same floor envelope initially; damage remains outside a continuous central route; any sag requires an agreed authored floor profile |
| Ancient ruined throne | One heavy stone seat, broad arms, fractured back and worn carving; mysterious rather than faction-branded | 3.6 × 3.6 m footprint, approximately 5.4 m total height; compare with 1.8 m person; faces local -Z toward the approaches |

For each asset supply:

- Editable `.blend` (or equivalent source), a self-contained optimized `.glb`, and
  front/side/top plus game-camera renders with the human scale reference.
- Applied transforms, metres, +Y up in the delivered glTF, uniform scale 1 and a
  ground-centred local pivot. Bridge pivot is at midspan X/Z and ground datum Y=0;
  deck geometry meets the agreed floor profile. Exported roots stay local.
- Named material slots, triangle/material counts, texture dimensions, byte size,
  license/source record and any meaningful node names. Mark tall silhouette pieces
  for the existing occlusion system where appropriate.
- A renderer-neutral footprint/floor specification matching the shared JSON.
  Decorative collision meshes are reference material only; runtime authority stays
  in semantic proxies. Include simple fallback geometry or retain the blockout.

Provisional targets to confirm with profiling: each bridge ≤30k triangles, ≤3
materials and ≤3 MiB; throne ≤15k triangles, ≤2 materials and ≤2 MiB. Prefer reused
1K textures and allow 2K only when visible detail warrants it. These are proposed
asset targets, not measured mobile performance. Use the existing GLB promotion
pipeline and glTF Transform prune/dedup; add compression only with matching runtime
decoder support. Preserve the game's existing DPR caps, ≤20-second representative
initial load target and <500 MB total payload limit.

Raw sources belong in ignored `authoring/local/area4/`, backed up outside Git.
Promote accepted runtime assets through `world-assets.json` and the asset manifest;
record provenance in `ASSET-LICENSES.md`. The concept PNG stays outside `public/`.

## Open questions

| Decision | Recommendation / impact |
| --- | --- |
| Final name | Keep “Area 4 / Burned Forest” until a name is chosen. |
| Region size | Start with the mirrored 144 × 48 m footprint; confirm that 36 m of land depth gives enough room before detailed terrain or encounters. |
| Unlock rule | Confirm the working Area 3 boss requirement for both bridges, or choose a later shortcut rule. |
| Skeletal material | Bone-shaped forged metal as the main structure; decide whether real bone is present and whose remains it evokes. |
| Bridge damage and sag | Cosmetic damage with a reliably walkable core for this game; physical collapse/falling would be a separate feature. |
| Throne scale and meaning | Start with 5.4 m overall height; decide whether “3× human” instead refers to the seated species' body scale, which could change seat proportions. |
| Throne placement and interaction | Southern landmark facing the arrivals; decide whether it is only scenery, a boss backdrop or a future progression interaction. |
| Lava behavior | Keep small pools impassable during blockout; decide later between barriers, damage zones and other mechanics. |
| Encounters and rewards | Define enemies, boss, affinities, spacing and loot in the dedicated content pass. |
| Asset delivery | Confirm creator/tooling, source backup location and who approves the three major assets before integration. |

## Verification and review

```bash
npm run authoring:viewer
npm run authoring:world:validate
npm run authoring:world:capture
npm run authoring:world:smoke-runtime -- --area4
npm run build
npm run validate:release
```

The viewer has A04 layout, throne and both bridge cameras. Generated evidence goes
under ignored `authoring/generated/captures/`; `area4-blockout.png` shows the actual
construction slice and `world-layout-area4-hires.png` is the full high-resolution
world overview. Validation covers locked/unlocked traversal both ways at 30/60
FPS, off-centre crossing, bridge rail containment, the continuous abyss barrier,
reachable clearings, one boss opening both connections, existing-save backfill and
Area 4 reloads. Browser smoke walks the southern loop and checks portrait views,
saved Reduced/30 FPS and playability without world assets. Browser emulation does
not establish real iPhone load time, memory or frame-rate performance.
