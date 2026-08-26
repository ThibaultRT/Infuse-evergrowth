# External environment pack evaluation

This evaluation is deliberately separate from runtime assets. The original downloads live in
`WIP/external-environment-source-archives/`; the catalogue script extracts them to a temporary
directory, inventories the GLTF/GLB files without renaming them, renders the real models, and
deletes the extraction. No environment implementation or procedural terrain is included.

## Decision summary

1. **KayKit Medieval Builder Pack 1.0 (Legacy) — best primary source.** It is the only evaluated
   pack that covers houses, roads, water/coasts, walls, a gate, bridges, and high-ground tiles in
   one visual language. Start visual review with its free-placement object models and square
   forest tiles. Hex tiles are useful catalogue references, not a recommendation to adopt a hex
   world.
2. **KayKit Dungeon Pack 1.1 FREE — best structural supplement.** Its modular wall, doorway,
   stair, floor, scaffold, and prop families are strong candidates for ruins and enclosed spaces.
   It has no houses, landscape, coast, trees, or meaningful cliff set.
3. **KayKit Forest Nature Pack 1.0 FREE — best nature supplement.** It offers much more rock,
   tree, bush, and grass variation than Medieval Builder, but the free tier contains no terrain,
   roads, structures, walls, gates, fences, or water.

The automatic candidate tags in each `inventory.csv`/`inventory.json` are filename-based review
aids, not final runtime selections. Dimensions and triangle counts were measured from Blender's
actual GLTF import. Every contact-sheet tile is rendered from that model and labelled with its
exact filename.

## Pack 1: KayKit Medieval Builder Pack 1.0 (Legacy)

- **Archive:** `KayKit Medieval Builder Pack 1.0.zip`
- **Inventory:** 226 binary GLTF files (`*.gltf.glb`), alongside FBX, OBJ/MTL, and DAE editions.
- **Contact sheets:** `medieval-builder/contact-sheet-01.png` onward, alphabetical by archive
  path. See `medieval-builder/inventory.csv` for the exact path-to-sheet ordering.
- **Strong candidates:**
  - houses/landmarks: `house.gltf.glb`, `barracks.gltf.glb`, `lumbermill.gltf.glb`,
    `market.gltf.glb`, `mill.gltf.glb`, `watermill.gltf.glb`, `castle.gltf.glb`;
  - roads: `square_forest_roadA.gltf.glb` through `square_forest_roadE_detail.gltf.glb`;
  - water/coasts: the `square_forest_water*` family, `square_water.gltf.glb`,
    `bridge.gltf.glb`, and `bridge_roofed.gltf.glb`;
  - walls/gates: `wall_straight.gltf.glb`, `wall_corner.gltf.glb`,
    `wall_gate.gltf.glb`, and `wall_gate_closed.gltf.glb`;
  - cliffs/high ground/rocks: `mountain.gltf.glb`, `detail_hill.gltf.glb`,
    `detail_rocks.gltf.glb`, `detail_rocks_small.gltf.glb`, and the rock terrain families;
  - vegetation: `detail_treeA.gltf.glb` through `detail_treeC.gltf.glb`,
    `detail_forestA.gltf.glb`, `detail_forestB.gltf.glb`, and `forest.gltf.glb`;
  - props: `well.gltf.glb`, `farm_plot.gltf.glb`, `mine.gltf.glb`, and
    `archeryrange.gltf.glb`.
- **Weak/missing categories:** no dedicated broken-wall/ruin or stair family; no standalone fence
  family. The defensive wall set can read as a gate solution but is small.
- **Materials/textures:** the GLB files embed their materials; there is no external atlas PNG next
  to the model set. The archive's PNGs are branding, overview, and sample images rather than
  runtime texture dependencies. This differs from the newer Dungeon/Forest one-atlas layout.
- **License/provenance:** created and distributed by Kay Lousberg on 30 July 2021, downloaded from
  <https://kaylousberg.itch.io/kaykit-medieval-builder-pack>, and supplied as CC0. The original
  `License.txt` remains inside the unmodified ZIP.

## Pack 2: KayKit Dungeon Pack 1.1 FREE

- **Archive:** `KayKit_Dungeon_Pack_1.1_FREE.zip`
- **Inventory:** 211 GLTF JSON files plus 211 matching BIN payloads; FBX and OBJ/MTL editions are
  also present.
- **Contact sheets:** `dungeon-1.1-free/contact-sheet-01.png` onward.
- **Strong candidates:**
  - walls: the complete `wall*.gltf` family, especially `wall_broken.gltf`,
    `wall_cracked.gltf`, `wall_half.gltf`, and scaffold/window/corner variations;
  - gates/ruins: `wall_gated.gltf`, `wall_corner_gated.gltf`,
    `wall_doorway.gltf`, `wall_arched.gltf`, and broken/cracked/scaffold pieces;
  - stairs/high ground: `stairs.gltf`, `stairs_long.gltf`, `stairs_narrow.gltf`,
    `stairs_wide.gltf`, `stairs_walled.gltf`, modular stair pieces, and foundation floors;
  - props: barrels, bottles, crates, banners, beds, benches, tables, chairs, chests, columns,
    shelves, stools, trunks, candles, food, keys, and weapon racks.
- **Weak/missing categories:** no houses, roads, natural water/coasts, cliffs, rocks, trees,
  vegetation, or outdoor fences. Floors can support paths/courtyards but should not be mistaken
  for landscape road tiles.
- **Materials/textures:** all GLTF models reference one shared `dungeon_texture.png` located beside
  the GLTFs. It is a 1024×1024 RGBA atlas; identical convenience copies are supplied for FBX,
  Unity-FBX, OBJ, and the textures folder. Sample/contents PNGs are documentation, not model
  dependencies.
- **License/provenance:** KayKit Dungeon Asset Pack 1.1, created and distributed by Kay Lousberg
  on 16 July 2026, downloaded from <https://kaylousberg.itch.io/kaykit-dungeon-pack>, CC0. The
  supplied `License.txt` is preserved inside the original ZIP.

## Pack 3: KayKit Forest Nature Pack 1.0 FREE

- **Archive:** `KayKit_Forest_Nature_Pack_1.0_FREE.zip`
- **Inventory:** 105 GLTF JSON files plus 105 matching BIN payloads; FBX and OBJ/MTL editions are
  also present.
- **Contact sheets:** `forest-nature-1.0-free/contact-sheet-01.png` onward.
- **Strong candidates:**
  - rocks/high-ground dressing: `Rock_1_A_Color1.gltf` through `Rock_1_Q_Color1.gltf`, eight
    `Rock_2_*` variants, and thirteen `Rock_3_*` variants;
  - trees/vegetation: the `Tree_1_*`, `Tree_2_*`, `Tree_Bare_*`, `Bush_1_*` through `Bush_4_*`,
    and `Grass_1_*`/`Grass_2_*` families. Double-sided grass is the safer first browser test;
    single-sided variants can be considered for tighter overdraw budgets.
- **Weak/missing categories:** no houses, roads, water/coasts, structural walls, gates, ruins,
  stairs, cliffs/terrain modules, fences, or built props in the free edition. Rocks can dress
  elevation but cannot define walkable high ground on their own.
- **Materials/textures:** all GLTF models reference one shared `forest_texture.png` beside the
  GLTFs. It is a 1024×1024 RGBA atlas; identical copies support the FBX, Unity-FBX, OBJ, and
  top-level texture workflows. `contents.png` and Samples are documentation only.
- **License/provenance:** KayKit Forest Nature Pack 1.0, created/distributed by Kay Lousberg on
  29 April 2025, downloaded from <https://kaylousberg.itch.io/kaykit-forest>, CC0. The supplied
  `License.txt` remains in the original ZIP.

## Category coverage matrix

| Category | Medieval Builder | Dungeon 1.1 FREE | Forest Nature FREE |
| --- | --- | --- | --- |
| Houses | Strong | None | None |
| Roads | Strong square/hex tiles | Floors only | None |
| Water/coasts | Strong tile families + bridges | None | None |
| Walls | Small intact set | Strong modular set | None |
| Gates | Two gate states | Gated/doorway/arched modules | None |
| Ruins | Weak | Strong broken/cracked/scaffold modules | None |
| Stairs | None | Strong | None |
| Cliffs/high ground | Terrain/mountain candidates | Foundations only | Dressing rocks only |
| Rocks | Small set + rock biome | None | Strong variation |
| Trees/vegetation | Small grouped set | None | Strong variation |
| Fences | None | None | None |
| Props | Small outdoor set | Strong interior/dungeon set | None |

## Recommended visual-review shortlist

Before importing anything into runtime assets, compare these on the contact sheets:

- `house.gltf.glb` and `lumbermill.gltf.glb`;
- `square_forest_roadA_detail.gltf.glb`, `square_forest_roadC_detail.gltf.glb`, and
  `square_forest_roadE_detail.gltf.glb`;
- `square_forest_waterStraight.gltf.glb`, `square_forest_waterInnerCorner.gltf.glb`, and
  `bridge.gltf.glb`;
- Medieval `wall_straight.gltf.glb`/`wall_gate.gltf.glb` versus Dungeon
  `wall_broken.gltf`/`wall_gated.gltf`;
- Dungeon `stairs_wide.gltf`, `stairs_walled.gltf`, and `wall_doorway_scaffold.gltf`;
- Forest `Rock_1_A_Color1.gltf`, `Rock_1_Q_Color1.gltf`, `Rock_3_M_Color1.gltf`, two Tree
  families, two Bush families, and double-sided Grass variants.

No final cross-pack runtime subset has been copied. Fence coverage remains unresolved and should
be checked in the supplied Kenney archives only after the requested KayKit visual choice.
