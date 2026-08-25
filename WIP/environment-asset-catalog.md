# Environment Asset Catalogue — Curated Runtime Subset

## Scope and status

This Slice 12A catalogue covers **all 14 environment models currently present in the curated browser runtime subset**. It does not claim to represent the full Quaternius Standard archives: the repository currently holds 8 models from Stylized Nature MegaKit Standard, 6 from Medieval Village MegaKit Standard, and no environment models from Fantasy Props MegaKit Standard.

Every pictured thumbnail below is a Blender 4.0.2 render of the named `.gltf` file in `public/assets/quaternius/`; no substitute geometry or generated asset is shown. The fixed orthographic isometric camera, transparent render, neutral two-light rig, filename labelling, and contact-sheet assembly are reproducible with:

```bash
blender --background --python scripts/render-environment-catalog.py
```

Dimensions and triangle counts were measured from the imported source meshes by that script. Dimension order is width × depth × height in metres after Blender's glTF coordinate conversion. The machine-readable results are retained in [`environment-catalog/catalog-metadata.json`](environment-catalog/catalog-metadata.json).

## Visual contact sheets

| Requested group | Contact sheet | Curated models |
| --- | --- | ---: |
| Cliffs / rocks | [View sheet](environment-catalog/cliffs-rocks.png) | 2 |
| Trees / vegetation | [View sheet](environment-catalog/trees-vegetation.png) | 5 |
| Roads / paths | [View sheet](environment-catalog/roads-paths.png) | 2 |
| Fences / palisades | [View sheet](environment-catalog/fences-palisades.png) | 2 |
| Houses / village structures | [View empty-category sheet](environment-catalog/houses-village-structures.png) | 0 |
| Walls / broken walls | [View sheet](environment-catalog/walls-broken-walls.png) | 1 |
| Gates / arches | [View sheet](environment-catalog/gates-arches.png) | 2 |
| Towers / ruins | [View empty-category sheet](environment-catalog/towers-ruins.png) | 0 |
| Bridges | [View empty-category sheet](environment-catalog/bridges.png) | 0 |
| Rubble / props | [View sheet](environment-catalog/rubble-props.png) | 1 |

`Prop_Brick1.gltf` appears on both the walls/broken-walls and rubble/props sheets because it is the subset's only masonry fragment and is relevant to both requested views. Empty-category sheets are intentional: they make gaps in the curated subset visible rather than implying that an asset was overlooked.

## Complete curated model inventory

All proposed runtime paths equal the current runtime paths because these files are already selected and shipped. “Base-oriented” means the imported object origin is suitable for placement on a ground surface; placement still needs visual validation in Blender before authored-world use.

| Source pack | Exact source filename | Category | Dimensions (m) | Triangles | Likely Infuse use | In runtime subset | Proposed runtime path | Pivot / orientation / shared textures |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| Stylized Nature MegaKit Standard | `Rock_Medium_1.gltf` | medium rock | 3.225 × 2.989 × 2.260 | 342 | ridge, shoreline, and border boulder | Yes | `nature/models/Rock_Medium_1.gltf` | Base-oriented, Z-up after import; shares `Rocks_Diffuse.png` with Rock 2. |
| Stylized Nature MegaKit Standard | `Rock_Medium_2.gltf` | medium rock | 3.049 × 2.479 × 1.899 | 244 | lower boulder variation and scatter | Yes | `nature/models/Rock_Medium_2.gltf` | Base-oriented, Z-up after import; shares `Rocks_Diffuse.png` with Rock 1. |
| Stylized Nature MegaKit Standard | `CommonTree_1.gltf` | deciduous tree | 4.311 × 4.578 × 7.265 | 6,265 | broad Area 1 tree clusters | Yes | `nature/models/CommonTree_1.gltf` | Trunk base placement, Z-up; shares normal-tree bark/leaf maps with Tree 3. |
| Stylized Nature MegaKit Standard | `CommonTree_3.gltf` | deciduous tree | 4.063 × 4.241 × 9.425 | 3,505 | tall canopy and skyline variation | Yes | `nature/models/CommonTree_3.gltf` | Trunk base placement, Z-up; shares normal-tree bark/leaf maps with Tree 1. |
| Stylized Nature MegaKit Standard | `Bush_Common_Flowers.gltf` | bush / flowers | 1.915 × 1.965 × 1.582 | 1,368 | flowering roadside and village greenery | Yes | `nature/models/Bush_Common_Flowers.gltf` | Base-oriented, Z-up; uses normal-tree leaves plus shared `Flowers.png`. |
| Stylized Nature MegaKit Standard | `Flower_3_Group.gltf` | flowers | 1.488 × 1.591 × 2.055 | 755 | conspicuous flower cluster and verge accent | Yes | `nature/models/Flower_3_Group.gltf` | Base-oriented, Z-up; uses shared leaf and flower maps. Note the unexpectedly tall 2.055 m source scale. |
| Stylized Nature MegaKit Standard | `Grass_Common_Short.gltf` | grass | 0.639 × 0.737 × 1.334 | 155 | sparse grass clump dressing | Yes | `nature/models/Grass_Common_Short.gltf` | Base-oriented, Z-up; uses `Grass.png`. Source height should be checked against intended world scale. |
| Stylized Nature MegaKit Standard | `RockPath_Round_Wide.gltf` | ground / path piece | 2.111 × 2.129 × 0.113 | 3,500 | individual stepping/path-rock accent | Yes | `nature/models/RockPath_Round_Wide.gltf` | Flat, centered tile; uses `PathRocks_Diffuse.png`. High triangle count for a small repeated tile. |
| Medieval Village MegaKit Standard | `Floor_UnevenBrick.gltf` | stone surface / path piece | 2.000 × 2.000 × 0.020 | 4 | small paved patch or modular floor tile | Yes | `village/models/Floor_UnevenBrick.gltf` | Flat 2 m tile, Z-up after import; shares the uneven-brick material maps. |
| Medieval Village MegaKit Standard | `Prop_WoodenFence_Single.gltf` | fence | 2.064 × 0.120 × 0.838 | 40 | short roadside or village boundary | Yes | `village/models/Prop_WoodenFence_Single.gltf` | Long axis X, base-oriented; shares wood-trim maps with fence extension and door. |
| Medieval Village MegaKit Standard | `Prop_WoodenFence_Extension1.gltf` | fence extension | 2.045 × 0.110 × 0.838 | 32 | continuous fence run without duplicate end detail | Yes | `village/models/Prop_WoodenFence_Extension1.gltf` | Long axis X, base-oriented; shares wood-trim maps with fence single and door. |
| Medieval Village MegaKit Standard | `Prop_Brick1.gltf` | rubble / masonry fragment | 0.346 × 0.250 × 0.208 | 108 | loose brick scatter; insufficient alone as a broken wall | Yes | `village/models/Prop_Brick1.gltf` | Small centered prop; shares rock-trim maps with the round brick frame. |
| Medieval Village MegaKit Standard | `DoorFrame_Round_Brick.gltf` | gate / arch | 1.603 × 0.477 × 2.586 | 2,046 | pedestrian-scale arch or compact physical gate | Yes | `village/models/DoorFrame_Round_Brick.gltf` | Opening faces depth axis; base-oriented; shares rock-trim maps with brick prop. |
| Medieval Village MegaKit Standard | `Door_4_Round.gltf` | gate door | 1.115 × 0.209 × 2.323 | 1,228 | moving door inside the compact round frame | Yes | `village/models/Door_4_Round.gltf` | Thin door plane; hinge behavior must be authored by a parent pivot; shares wood/metal trim maps. |

## Coverage assessment

### Present in the curated subset

- medium rocks, but no cliff or high-ground modules;
- two deciduous trees, a flower bush, flowers, and grass;
- one rock-path accent and one modular brick floor;
- two compatible wooden fence pieces;
- one loose brick;
- one pedestrian-scale brick arch and one matching round door.

### Absent from the curated subset

- small and large rock families, cliffs, ledges, and high-ground pieces;
- conifers and dead/dark trees;
- dirt/soil/grass ground surfaces and road systems;
- palisades;
- bridges and causeways;
- houses, wells, carts, barrels, crates, and signs;
- modular wall straights, corners, ends, and true broken-wall pieces;
- wide gates and freestanding arches;
- towers, ruins, ruined buildings, stairs, and platforms;
- rubble/debris sets beyond a single loose brick;
- every environment prop from Fantasy Props MegaKit Standard.

## Selection conclusion

The curated subset is visually usable for **vegetation dressing, medium boulders, light fencing, small paved accents, and the existing compact gate prototype**. It is not sufficient for a non-procedural redesign of Areas 1–3: every major architectural, cliff, bridge, ruin, and prop category remains empty. The full source archives should be re-uploaded before making the next environment selection pass.
