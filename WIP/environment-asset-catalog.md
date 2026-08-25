# Environment Asset Catalogue

## Status

**12A is started but not complete.**

The current repository contains only a deliberately curated runtime subset of the three Quaternius environment packs. The full source archives are not present in `main`, and they were not recoverable from the current File Library search. Therefore this document records only assets already verified from the earlier source-pack inspection and the current runtime subset.

Do not treat this as the final catalogue. The next 12A task is to inspect the actual full Standard archives again and expand this list before the Blender beauty pass.

## Verified source-pack scale

| Pack | Verified Standard glTF count | Main relevance |
| --- | ---: | --- |
| Medieval Village MegaKit | 176 | modular village structures, walls, floors, doors, fences |
| Stylized Nature MegaKit | 68 | trees, rocks, bushes, flowers, grass, rock paths |
| Fantasy Props MegaKit | 94 | furniture and environmental props |

## Current verified runtime candidates

### Nature

| Asset | Approx. size / cost | Use | Runtime status |
| --- | --- | --- | --- |
| `CommonTree_1.gltf` | ~6,265 tris, ~7.26 m tall | bright deciduous tree, Area 1 clusters | present |
| `CommonTree_3.gltf` | ~3,505 tris, ~9.43 m tall | taller tree / Area 1-2 silhouette | present |
| `Rock_Medium_1.gltf` | ~342 tris | medium boulder / shoreline / ridge accents | present |
| `Rock_Medium_2.gltf` | ~244 tris | medium boulder variation | present |
| `Bush_Common_Flowers.gltf` | ~1,368 tris | village/road vegetation | present |
| `Flower_3_Group.gltf` | ~755 tris | small ground dressing | present |
| `Grass_Common_Short.gltf` | ~155 tris | small grass clumps | present |
| `RockPath_Round_Wide.gltf` | ~3,500 tris, ~2.1 m tile | authored path detail | present |

### Village / gate

| Asset | Approx. size / cost | Use | Runtime status |
| --- | --- | --- | --- |
| `Prop_WoodenFence_Single.gltf` | ~40 tris, ~2.06 m span | road/village fence | present |
| `Prop_WoodenFence_Extension1.gltf` | ~32 tris | fence continuation | present |
| `Prop_Brick1.gltf` | ~108 tris | rubble / broken wall scatter | present |
| `Floor_UnevenBrick.gltf` | 2×2 m tiled plane | small paved patches, not whole-area ground | present |
| `DoorFrame_Round_Brick.gltf` | ~2,046 tris, ~1.6×2.59 m | physical gate/arch prototype | present |
| `Door_4_Round.gltf` | ~1,228 tris, ~1.11×2.32 m | dynamic gate door | present |

## Known gaps that must be resolved from the full source packs

The approved world cannot be built convincingly from the current runtime subset alone. Before 12D, the full source audit must find and visually verify candidates for at least:

- large cliff/high-ground pieces suitable for Area 1 west border;
- bridge/causeway parts;
- village houses/landmarks;
- additional fence/palisade variants;
- wall straight/corner/end pieces;
- broken/ruined wall pieces;
- towers and ruined towers;
- arches/gates wider than the current small brick door frame;
- stairs/platforms;
- rubble/debris variants;
- carts, barrels, crates, signs and wells;
- dead/darker vegetation for Area 2;
- any existing ruined-building modules suitable for Area 3 rooms/corridors.

## Contact-sheet requirement

For the completed 12A catalogue, every selected candidate above must be shown on labelled contact sheets rendered from the **actual source model** at a fixed Infuse-like isometric camera. AI-generated stand-ins are not acceptable for asset selection.

Preferred renderer/editor: **Blender**.

## Import rule

Only selected assets should be copied into `public/assets/quaternius/` for runtime use. Do not dump all original pack ZIPs or every source model into the browser payload.

The runtime subset should expand deliberately from the contact-sheet selections, while preserving the existing asset-provenance/license records.