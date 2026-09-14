# Area 4 — burned forest construction plan

## Direction

The working region name remains **Area 4 / Burned Forest**; choosing a separate lore
name is not required for the environment pass.

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
- [x] Normalize both rift transitions to A01/A02: a 12 m span centered on Z=36,
  3 m approaches, shared collision/floors, and the A03 south wall/gate at Z=30.

Slice 1 is verified. S2/W2 and their gates are now integrated as the first slice 2
models; the terrain, throne, trees and lava remain blockouts. This work adds no
encounters, boss, loot, damage-over-time, falling, bridge collapse or particles.
Area 4's unused enemy affinity header is provisional until encounters are authored.

## Spatial contract

1 unit = 1 metre; +X east, -Z north, +Y up. Areas 1–3 keep their roots and dimensions.

| Element | World placement / dimensions |
| --- | --- |
| Area 1 | Root `(0,0,0)`; playable 72 × 72 m |
| Area 2 | Root `(36,0,-60)`; playable 144 × 48 m |
| Area 3 | Root `(72,0,0)`; playable 72 × 72 m |
| Area 4 | Root `(36,0,60)`; playable 144 × 48 m; visual 156 × 60 m |
| Area 4 playable bounds | X `-36..108`, Z `36..84` |
| Combined Areas 1 + 3 width | Playable X `-36..108` = 144 m; visual X `-42..114` = 156 m |
| Both transition chunks | Visual 84 × 12 m; local Z `-6..6`; world Z `30..42` |
| Rift | World Z `30..42`; 12 m span, floor Y `-10`; 6 m into each adjacent area |
| Solid Area 4 ground | Begins at world Z `42`; 42 m of playable depth remains south of the rift |
| Area 1 crossing | World X `7.2`; transition root `(0,0,36)` |
| Area 3 crossing | World X `86` (A03 local X `14`); transition root `(72,0,36)` |
| Both bridge decks | 3.4 m clear width, world Z `30..42` at Y `0.6`, midpoint at Z `36` |
| Both complete walk profiles | World Z `27..45`; 3 m approach at each end, Y `0` at both landings |
| S2 land gate | World `(7.2,0,27)`; separate bone/iron module before the north ramp |
| Area 3 south wall/gate | Transition-local `(14,0,-6)`, world `(86,0,30)`; existing masonry with inland hinges at world Z=29.3, scale 1 |
| Throne | A04 local `(0,0,15)`, world `(36,0,75)`; 3.6 × 3.6 m footprint, 5.4 m tall |

The area ownership seam remains at world Z `36`, now at the deck midpoint as for
A01/A02. Each transition supplies the same compiled collision and walk surfaces to
both adjacent areas, so the hero stays at Y `0.6` when ownership changes. The rift
occupies 6 m of Areas 1 and 3 and 6 m of Area 4 without moving any root or expanding
an area. The two transition chunks meet at world X `36` and own separate halves of
the abyss.

Area 3's south wall/gate moves north to the rift edge at Z `30`; its corner joins
move with it and the east/west curtain runs shorten. Existing encounters and reserved
clearings remain reachable. The northern landscapes, southern paths and scatter
meet the new bank, while all overlapping terrain (including the A01/A03 apron)
uses the shared rift cutout. Detailed bank silhouettes remain part of the final art pass.

Area 4 does not exceed the combined authored width of Areas 1 and 3. Each northern
area is 72 m playable / 84 m visual, and their roots meet at X `36`; Area 4 therefore
matches their combined 144 m playable width and 156 m visual width exactly. The
slight side protrusion in the overview screenshot comes from the nearer Area 4 plane
appearing wider in perspective, not from a bounds mismatch, so no width change is
required.

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

1. **Verify the approved blockout dimensions.** Walk the southern loop and check travel
   distance and portrait sightlines without changing the confirmed 144 × 48 m playable
   footprint or 5.4 m throne height. Any later expansion would require revisiting the
   routes and encounter spacing.
2. **Approve the major-asset concepts.** Produce a few 2D directions for the skeletal
   bridge, ruined timber bridge and ancient throne. A close, freely licensed online
   asset may be proposed instead when its style and dimensions genuinely fit; record
   its source and license and obtain approval before adopting it.
3. **Model the approved concepts.** Build the selected assets in Blender, or adapt an
   approved free asset, against the contracts below. S2/W2 and their gates were
   authorized for direct modeling and integration; review them together with the
   throne after the user supplies its 2D reference.
4. **Build terrain and the rift banks.** Add ash/charcoal ground, jagged northern and
   southern lips, dark abyss depth, small lava basins and clear readable paths.
   Reconcile the old Greenhaven/Fallen Keep cliff geometry and A04 terrain cutouts.
   Keep Y=0 walkable ground and reserve the routes/clearings. Avoid a large lava river.
5. **Integrate the approved major assets.** Add the approved assets to the asset
   library and replace each placeholder presentation at its existing named placement.
   Retain semantic collision and authored walk profiles;
   update the shared spec first if a reviewed asset needs different dimensions.
   Verify both bridge landings, gate opening and throne occlusion with actual movement.
6. **Dress the burned forest.** Prepare a small set of scorched trunks, stumps, fallen
   logs and basalt rocks. Use restrained deterministic scatter with exclusions around
   paths, pools, gates, spawn spaces and the throne. Keep a playable visual fallback.
7. **Author gameplay in a later, separate content pass.** Agree encounters, affinities, boss,
   rewards and any throne interaction. Add stable spawn IDs and authored HP/damage/
   reward ranges in `src/data/areas/area-4.json`. Lava remains blocked by authored
   collision; damage or other lava mechanics require a separate decision. Any new save
   shape needs full versioned migration.
8. **Polish and validate.** Add restrained ember/light effects only after profiling.
   Check Full/Reduced and Smooth/30 FPS, offline revisits, loading fallback and a real
   iPhone 12-class device before considering the environment finished.

## Major asset handoff

Slice 1 is verified by the user. For slice 2, the user selected **S2 — Rib vault**
and **W2 — Scorched patchwork** from the local concept set under
`authoring/local/area4/concepts/slice-2-v1/`. The throne will use a separate
user-supplied 2D reference. The revised gate concepts under
`authoring/local/area4/concepts/slice-2-gates-v1/` were accepted for direct 3D
implementation. Both bridges and their gates are now shipped in the asset library.
The user requested focused integration checks now and one joint visual review
after the throne is modeled.

### Gates for the selected bridges

Both crossings have one operable gate at the northern entrance, driven by the
existing Area 3 boss unlock. The old bridge-owned lock has been removed; the
separate gate placement owns its presentation and lock proxy. No gate-specific
persistent state or new unlock requirement was added.

- **S2 / Area 1:** a bone-framed, forged-metal double gate with its feet planted in
  Area 1's land at the beginning of the north approach. The gate plane is
  world `(7.2, 0, 27)`, before the 3 m ramp; the rib-vault span begins at Z=30.
  Gate leaves open toward the Area 1 land side and park outside the 3.4 m clear lane.
  The land gate is a separate module matching S2's real-bone/metal theme.
- **W2 / Area 3:** fit substantial iron-braced timber double doors into the existing
  ruined masonry gateway. Use its normalized world centre `(86, 0, 30)`, 14 m module width,
  3.45 m opening and established stone/arch appearance. The wall/gate module is one
  asset; W2 is a separate bridge with no gate. Offset hinges on the inland face
  leave the full 3.4 m route clear when open. The leaf bottoms follow the ramp
  height at the inland door plane, Z=29.3; the deck still reaches Y=0.6 at Z=30.

Each transition owns its gate and separate bridge. `A03_SouthGate` now belongs to
the A03/A04 transition at the same normalized world placement; Area 3 keeps the
surrounding curtain-wall runs. The existing named hinged-leaf mechanism opens
both pairs inland. `area4-bridges.json` supplies the gate dimensions and hinge
offsets used by Blender and semantic collision. Loading failures retain blockout
decks, rails, gateway frames and the existing locked-bar fallback.

### Delivery contract

S2/W2 and the two gates were modeled and integrated under the user's direct
authorization. The throne remains unchanged pending its supplied 2D reference.
Any future third-party replacement still needs fit, license and provenance review.

The editable source is `authoring/local/area4/models/area4-s2-w2.blend`.
`export-area4-bridges.py` and `optimize-area4-bridges.mjs` reproduce the four
self-contained, vertex-colored GLBs. Their combined runtime size is 2.09 MiB:

| Model | Triangles | Materials | MiB |
| --- | ---: | ---: | ---: |
| S2 rib vault | 11,532 | 2 | 0.81 |
| S2 land gate | 2,768 | 2 | 0.20 |
| W2 timber bridge | 9,694 | 1 | 0.70 |
| W2 wall/gate | 5,732 | 3 | 0.39 |

| Asset | Art brief | Required fit |
| --- | --- | --- |
| Skeletal bridge — selected S2 | A long real-bone rib vault with a vertebral ridge and dark forged-metal reinforcement; readable from portrait camera | 3.4 m uninterrupted clear deck, 12 m level span, 3 m approach each end; local +Z along crossing; no ribs inside clearance; separate land gate |
| S2 land gate | Real-bone jambs/frame and substantial forged-metal hinged leaves matching the selected bridge | Feet on Area 1's land before the north ramp; open leaves outside the 3.4 m clear lane |
| Ruined timber bridge — selected W2 | Charred timber with weathered replacement boards, rope lashings and damaged outer rails; all damage is cosmetic | Same floor envelope initially; continuous central route; no gate on the bridge; visual sag must match the authored floor profile |
| Area 3 wall/gate module | Existing ruined masonry gateway fitted with iron-braced timber hinged doors | Preserve the Z=30 wall join, 3.45 m opening and Y=0.6 floor at the north deck edge; at least 3.4 m clear when open; separate from W2 |
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

## Resolved decisions

| Decision | Resolution / impact |
| --- | --- |
| Region name | Keep **Area 4 / Burned Forest** as the working name; a separate lore name can wait. |
| Region size | Keep the 144 × 48 m playable and 156 × 60 m visual footprints. The depth is approved, and the width exactly matches the combined Areas 1 and 3 bounds; the screenshot's apparent side protrusion is not an authored-width error. |
| Unlock rule | Defeating Area 3 boss `area3-epic-01` opens both Area 4 bridges. |
| Transition convention | Match A01/A02: seam Z=36 at midspan, rift/decks Z=30..42, approaches Z=27..45; shared collision/floors. Move A03's south wall to Z=30, keeping all area roots and footprints fixed. |
| Skeletal material | Use real bones, with a long rib-cage silhouette plausibly belonging to a dragon-scale creature; forged metal may reinforce the structure. |
| Bridge concepts | S2 — Rib vault and W2 — Scorched patchwork, including the revised gates, are modeled and integrated. The user will supply the throne reference separately. |
| Gate placement and asset split | S2 receives a matching gate planted on Area 1's land before its approach. W2 uses doors integrated into the existing Area 3 wall/gate module, with the bridge as a separate asset. Both use the existing shared progression unlock. |
| Bridge damage and sag | Damage is cosmetic only. Preserve a continuous collision-supported route and do not create any hole large enough to fall through. |
| Throne scale | Fix the throne at 5.4 m overall height; this dimension takes precedence over interpreting “3× human” as an exact anatomical scale. |
| Throne placement and interaction | Keep it centered in the southern landmark position at A04 local `(0,0,15)`. It is cosmetic scenery only, with no boss or progression interaction. |
| Lava behavior | Give every lava pool authored collision so the hero cannot run on it. Lava damage and other mechanics are not part of this decision. |
| Encounters and rewards | Out of scope for the environment work; author them later as a separate content pass. |
| Asset delivery | S2/W2 were authorized for direct modeling and integration. Defer the joint environment review until the user-supplied throne is modeled. |

## Verification and review

Focused bridge checks: `node scripts/world-authoring/validate-area4-bridges.mjs`
checks packed assets, actual hinge clearance, visual deck/profile agreement and
locked/unlocked traversal. It is also included in the full world validator.
`npm run authoring:world:capture -- --area4-bridges` captures only the two gates
closed/open and the two portrait bridge views. The current session's headless
browser capture crashed; Blender export previews are saved as
`authoring/generated/captures/area4-{s2,w2}-model-preview.png` instead.
Full world/device verification is deferred to the joint throne review.

Broader review commands for that pass:

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
FPS, off-centre crossing, shared floor continuity at the Z=36 seam, rail containment
on both sides, the continuous Z=30..42 abyss barrier in all three adjacent areas,
reachable clearings, one boss opening both connections, existing-save backfill and
Area 4 reloads and the moved A03 wall/corner joins. Browser smoke walks the southern
loop and both bridges in Full and saved Reduced/30 FPS, captures both sides of the
seam and landings, and crosses with world assets unavailable. Browser emulation does
not establish real iPhone load time, memory or frame-rate performance.
