# Third-party asset licenses

## Fallen Keep ruins

- Files: `public/assets/world/shared/models/fallen-keep-*.glb`.
- The broken curtain walls, hollow corner towers, breached gatehouse, four roofless
  building shells, weathered paving and rocky outer apron were authored for this
  project through Blender MCP from the owner's `Layout.png` reference. They use
  portable vertex colors; semantic footprints are shared in `fallen-keep.json`.
  The soil reuses the accepted Poly Haven `terrain-cobble-color.jpg` as an embedded,
  desaturated 512px palette variant; the original texture is unchanged.
- The demolished catapult reuses `siege-catapult-demolished.glb` and its embedded
  palette from [Kenney's Castle Kit](https://kenney.nl/assets/castle-kit), CC0 1.0.
  Downloaded September 11, 2026 from
  `https://kenney.nl/media/pages/assets/castle-kit/a395102d20-1711543616/kenney_castle-kit.zip`.
  Archive SHA-256: `921f3f73927bb23106cae34bc21d5ab4b033a9fc120475e96f714a406e3169df`.
  Its notice is retained at `public/assets/world/shared/licenses/kenney-castle-cc0.txt`.
- Existing KayKit rubble and the project's Highwood trees retain their provenance
  below. The asset review preferred these reusable props; the available wall models
  had intact upper beams and did not provide the required collapsed silhouettes.
- Reproduction: `scripts/world-assets/export-fallen-keep.py`, executed through
  Blender MCP. It verifies the source archive and exports ten self-contained GLBs,
  plus `authoring/local/fallen-keep/fallen-keep.blend`. The local creative scene and
  source archive are not shipped.
- Area 4 seam normalization regenerates only the landscape with `--landscape-only`.
  The north rift edge comes from `area4-blockout.json`; paving stops there and the
  cliff leaves the timber crossing clear. The separate local source is
  `authoring/local/fallen-keep/fallen-keep-landscape.blend`. No new third-party assets
  or licenses are introduced.

## Quaternius

The following Quaternius Standard asset packs have been inspected from the actual source ZIPs selected for Infuse: Evergrowth:

- Medieval Village MegaKit [Standard]
- Stylized Nature MegaKit [Standard]
- Fantasy Props MegaKit [Standard]
- Universal Base Characters [Standard]
- Modular Character Outfits - Fantasy [Standard]
- Universal Animation Library [Standard]
- Universal Animation Library 2 [Standard]

**Creator:** Quaternius  
**License:** CC0 1.0 Universal / Public Domain Dedication  
**Commercial use:** permitted  
**Modification:** permitted  
**Attribution:** not required  
**License reference:** https://creativecommons.org/publicdomain/zero/1.0/

Each supplied Standard archive contains its own Quaternius license file declaring CC0 1.0. Runtime derivatives may be resized, repacked, renamed, trimmed or otherwise optimized for the browser while remaining covered by the same CC0 dedication.

The original source archives are intentionally not intended for the shipped web application. Keep only the selected runtime subset needed by implemented areas/features.

Runtime selection and promotion rules are documented in `authoring/README.md`; exact shipped files are recorded by their runtime manifests.

## Typed-world runtime subset

The environment recreated from the approved prototype uses a curated subset under
`public/assets/world/shared/`. The exact semantic key, upstream source path,
promoted filename, source SHA-256 and runtime SHA-256 are recorded in
`public/assets/world/asset-manifest.json`.

- KayKit Medieval Hexagon buildings, walls, bridges, fences and props are repacked
  from their source glTF dependency trees into self-contained GLBs. Creator: Kay
  Lousberg. License: CC0 1.0. The supplied notice is retained as
  `public/assets/world/shared/licenses/kaykit-medieval-hexagon-cc0.txt`.
- KayKit Forest and legacy Dungeon models are likewise repacked as self-contained
  runtime GLBs. Creator: Kay Lousberg. License: CC0 1.0; canonical source links are
  recorded in the KayKit section below.
- Quaternius Stylized Nature MegaKit models are repacked into self-contained GLBs.
  Creator: Quaternius. License: CC0 1.0. The supplied notice is retained as
  `public/assets/world/shared/licenses/quaternius-stylized-nature-cc0.txt`.
- Poly Haven's four accepted 1K terrain material pairs are copied with descriptive
  runtime names under `public/assets/world/shared/textures/`. Their individual
  credits and source pages are listed below.
- Area A01 uses the project-supplied fountain at
  `public/assets/models/props/fountain.glb`, referenced directly by the typed world
  asset catalog and recorded in the runtime manifest.

Raw source dependency trees, reference screenshots and the complete upstream
provenance ledger remain in the ignored, checksummed
`authoring/local/world-development/` library. They are not shipped.

## KayKit environment proof subset

The curated runtime files under `public/assets/kaykit/` come from these original, unmodified archives retained under `source-assets/`:

- KayKit Medieval Builder Pack 1.0 (Legacy), downloaded from <https://kaylousberg.itch.io/kaykit-medieval-builder-pack>;
- KayKit Dungeon Pack 1.1 FREE, downloaded from <https://kaylousberg.itch.io/kaykit-dungeon-pack>;
- KayKit Forest Nature Pack 1.0 FREE, downloaded from <https://kaylousberg.itch.io/kaykit-forest>.

**Creator:** Kay Lousberg

**License:** CC0 1.0 Universal / Public Domain Dedication

**License reference:** https://creativecommons.org/publicdomain/zero/1.0/

Only the models used by the constrained in-game proof and their shared Dungeon/Forest texture atlases are copied into the runtime hierarchy. The source ZIPs and documentation/contact sheets are not part of the deployed asset tree.

## Inventory weapon rarity icons

- Files: `src/assets/ui/equipment/*.svg`
- Source: three weapon-rarity strips supplied directly by the project owner in the feature request (hammer, sword, and spear; common through legendary).
- Processing: each source strip was divided into five square tiles and resized to 256×256 and wrapped as text-based SVG data images so the assets remain reviewable by text-only pull-request tooling.
- Usage: project-owned/user-supplied artwork; included with permission for Infuse: Evergrowth.

## Project-supplied world models

- Files: `public/assets/models/**/*.glb`
- Source: crystal, fountain, and rare-enemy models supplied directly by the project owner.
- Processing: files were organized into the runtime asset hierarchy; their displayed scale and placement are normalized at runtime.
- Usage: project-owned/user-supplied artwork; included with permission for Infuse: Evergrowth.

## Woodland bridge

- File: `public/assets/world/shared/models/woodland-bridge.glb`.
- Source: the project owner's `woodland_bridge.blend`, supplied from the September 10, 2026 Blender design task.
- Source SHA-256: `dc2155f3678ad24bd4ff5a72729ab063c268cc754db2fd63500feaec53d28cfa`.
- Processing: procedural oak and cedar baked to embedded color maps; rope, ivy and hardware retain material colors as vertex colors; curves reduced and static geometry batched for browser use. The two side hinges and canopy occlusion group remain separate.
- Normalization: the deck spans 12 meters with its floor at 1.65 meters. The shared dimensions are in `src/data/world/woodland-bridge.json`; production placement, rail/door proxies and approach profiles remain renderer-independent.
- Reproduction: open the supplied source with Blender in background mode and run `scripts/world-assets/export-woodland-bridge.py`, then `npm run authoring:assets:promote -- crossing.woodlandBridge`.
- Usage: project-owned/user-supplied artwork; included with permission for Infuse: Evergrowth. The creative `.blend` and its packed reference are not shipped or modified.

## Greenhaven landscape and village details

- Files: `public/assets/world/shared/models/greenhaven-*.glb`.
- The landscape, pines, boulder, low timber fences, and closed southern bridge were procedurally authored for this project in Blender from the owner's `Layout.png` reference. They contain portable vertex colors and no external texture dependencies.
- `greenhaven-home-a.glb` and `greenhaven-home-b.glb` are warm-roof palette variants of Kay Lousberg's CC0 KayKit Hexagon homes, derived from the already-promoted `keep-home-red-a.glb` and `keep-home-red-b.glb`. Geometry, pivots and scale are preserved; the modified palette is embedded. The upstream license remains under `public/assets/world/licenses/`.
- Reproduction: `scripts/world-assets/export-greenhaven.py` reads `src/data/world/greenhaven.json` and writes the nine runtime GLBs plus an editable local scene at `authoring/local/greenhaven/greenhaven.blend`. The local `.blend` is not shipped.
- The Area 4 rift cutoff also reads `area4-blockout.json`. Use `--landscape-only` to rebuild its remaining cliffs/paving/foliage without rewriting the other models; this saves `authoring/local/greenhaven/greenhaven-landscape.blend`. The regenerated landscape retains the same project-owned provenance. The transitions now supply the deep southern banks.
- The existing project-supplied fountain and woodland bridge retain their original provenance above.

## Highwood terrain and woodland

- Files: `public/assets/world/shared/models/highwood-*.glb`.
- The rock formations, worn path stones and dry undergrowth were authored through Blender MCP from `Layout.png`. Their renderer-neutral footprints and paths are in `src/data/world/highwood.json`. The existing Poly Haven forest material remains the walkable ground and loading fallback.
- The three leafless trees reuse Kay Lousberg's CC0 Forest Nature Pack models `Tree_Bare_1_A_Color1`, `Tree_Bare_1_B_Color1`, and `Tree_Bare_2_A_Color1` from the existing local archive. The source archive SHA-256 is `2ee83e63bb7695f2d884ec27ddf6fce020789a452e7d5c5b0bbdfc4f6ea1fc8c`. Geometry is scaled to meters and recolored as weathered bark. The supplied license is retained as `shared/licenses/kaykit-highwood-cc0.txt`.
- The two shaded pines are palette variants of the project's existing Greenhaven pine geometry.
- The timber lookout reuses Quaternius's [Small Watch Tower](https://poly.pizza/m/CygapExMf5), from [Ultimate Fantasy RTS](https://quaternius.com/packs/ultimatefantasyrts.html), released under CC0 1.0. Downloaded September 11, 2026 from `https://static.poly.pizza/8bec6466-329a-4f83-99d9-600a00e2c437.glb`; source SHA-256: `697dbc949daa279858e3e4ebed1b3039137bfb9e5be97d783be323a7786dd27f`.
- Its pointed roof reuses `roof-point.glb` from Kenney's [Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit), CC0 1.0, already in the local asset library. The source archive SHA-256 is `1a7530c09f4d2fa2cdee259876f089334f8b1f27fa86a0c4f54ef86cdd8676ef`. The supplied notice is retained as `shared/licenses/kenney-fantasy-town-cc0.txt`.
- Reproduction: `scripts/world-assets/export-highwood.py` exports seven self-contained, vertex-colored GLBs and the editable `authoring/local/highwood/highwood.blend`. Imports are isolated from other open Blender scenes; only the selected authored scene is exported. The lookout is batched to one material with its roof, and source hashes are checked before conversion.

## Area 4 S2/W2 bridges and gates

- Files: `public/assets/world/shared/models/area4-s2-rib-vault.glb`, `area4-s2-land-gate.glb`, `area4-w2-timber-bridge.glb`, and `area4-w2-wall-gate.glb`.
- Source: project-authored Blender models following the owner's approved S2/W2 bridge and gate concepts. The concept images are retained under `authoring/local/area4/concepts/`; no concept textures are included in the runtime assets.
- The W2 wall/gate reuses the project's existing `fallen-keep-gate.glb` masonry unchanged, adding timber leaves and forged hardware. The source hash is recorded in `authoring/local/area4/models/source-manifest.json`.
- Processing: shared renderer-neutral bridge/gate dimensions, vertex colors, batched static geometry, named hinge pivots, and an independently fading S2 rib vault. glTF Transform weld/dedup/prune preserves these nodes. Four self-contained GLBs total 2.09 MiB with no external textures or compression decoders.
- Reproduction: `scripts/world-assets/export-area4-bridges.py`, then `scripts/world-assets/optimize-area4-bridges.mjs --tool-root <gltf-transform installation root>` and the promotion commands in `authoring/README.md`. Editable source: `authoring/local/area4/models/area4-s2-w2.blend`; it is not shipped.
- Usage: authored for Infuse: Evergrowth under the project owner's direction. No new third-party assets were introduced.

## Area 4 supplied throne

- File: `public/assets/world/shared/models/area4-throne.glb`.
- Source: `Throne-area4.glb`, supplied directly by the project owner for implementation. Original SHA-256: `79121ec376e754c6ca76cc762f200fd975acae135e40822dd5b535b99eb7e5de`. The unchanged source is retained under `authoring/local/area4/throne/Throne-area4-source.glb`.
- Processing: glTF Transform weld/simplify/dedup/prune; 31,608 triangles reduced to 14,900. All three original 1024 × 1024 JPEG maps are preserved unchanged. Uniform scaling is baked to 5.4 m tall, centred at ground level, with the original seat facing -Z. Runtime size: 948,856 bytes (0.90 MiB), one material, no added decoder dependencies.
- Reproduction: `scripts/world-assets/prepare-area4-throne.mjs --tool-root <gltf-transform installation root>` and `npm run authoring:assets:promote -- ruin.ancientThrone`. The local build report records bounds and source/runtime/texture hashes.
- Usage: user-supplied artwork included with the project owner's permission for Infuse: Evergrowth; no broader redistribution license is asserted.

## Area 4 terrain and Rift banks

- Source: project-authored procedural geometry, vertex colors and one 256px ash-grain texture in `src/rendering/environment/Area4TerrainView.ts`, driven by the renderer-neutral Area 4 layouts and dimensions. No third-party textures, models or generated-image references are used in this terrain pass.
- Content: flat charcoal/ash ground and paths, fractured rift banks with unlit dark depth, and three small lava basins within the existing collision footprints. Ground and bank geometry are reproducible in the production builder and assembled debug GLB.
- The Greenhaven and Fallen Keep landscape GLBs were regenerated without their shallow southern cliff rocks. Their existing sources and provenance are unchanged; reproduction uses each existing Blender exporter with `--landscape-only`, followed by glTF Transform dedup/prune and manifest promotion.

## Area 4 burned forest dressing

- Files: `public/assets/world/shared/models/area4-charred-*.glb` and `area4-basalt-*.glb`.
- Geometry: six project-authored reusable meshes (two scorched trunks, a stump, a fallen log and two basalt rocks), reproduced by `scripts/world-assets/export-area4-forest.py`. Editable source: ignored `authoring/local/area4/forest/area4-forest.blend`.
- Bark color/normal maps: [Bark Willow](https://polyhaven.com/a/bark_willow), photographed by Dimitrios Savva and processed by Dario Barresi.
- Rock color/normal maps: [Dark Rock](https://polyhaven.com/a/dark_rock), by Amal Kumar.
- Both texture sets are [CC0 1.0](https://polyhaven.com/license). Their exact download URLs and source SHA-256 hashes are tracked in `scripts/world-assets/area4-forest-sources.json`; `prepare-area4-forest.mjs --download` retrieves and verifies the four source maps.
- Processing: 1K source maps resized to 512² JPEG color and OpenGL normal maps; baked metre-scale geometry, charcoal/stone material tints, one material/draw per GLB, glTF Transform weld/dedup/prune, no compression decoder or external dependencies. Six GLBs total 0.95 MiB. No image or 3D generation service is used in this pass.
- Usage: authored for Infuse: Evergrowth under the project owner's direction.

## Area 4 supplied eastern fence and gate

- Files: `public/assets/world/shared/models/area4-east-fence.glb` and `area4-east-gate.glb`.
- Source: the project owner's `Fence-area4.glb` and `Gate-area4.glb`, supplied directly for this implementation. Original SHA-256: fence `33d212cbb39396e61de24901215ee5524adb9f104c0314ec6e9376403a346167`; gate `6874379789b8ecec538477d04794655487530e1d5d99432c98b9ff85192ba2a4`. Unchanged originals are retained in `authoring/local/area4/boundaries/source/`.
- Processing: isolated Blender 5.2 scene, mesh decimation from 31,036 / 30,706 triangles to 4,000 / 9,000; uniform scale baked to 8.5 / 8 m wide, ground-centred pivots and preserved proportions. glTF Transform weld/dedup/prune packages one material and three embedded 1024² JPEG PBR maps per asset, without decoder dependencies. Combined size: 2,080,100 bytes (1.98 MiB).
- Reproduction: `scripts/world-assets/export-area4-boundaries.py`, `scripts/world-assets/optimize-area4-boundaries.mjs --tool-root <gltf-transform installation root>`, then the promotion commands in `authoring/README.md`. The editable `.blend` and build reports are ignored local sources.
- The southern lava lake is project-authored procedural geometry/vertex colors in `Area4TerrainView.ts`; it adds no third-party material or generated image.
- Usage: user-supplied artwork included with the project owner's permission for Infuse: Evergrowth; no broader redistribution license is asserted.

## Rare enemy runtime LODs

- File: `public/assets/models/enemies/enemy-rare-lods-v1.glb`.
- Source: project-owner rare-enemy artwork, formerly `public/assets/models/enemies/enemy-rare.glb`; preserved in Git at `e238e13`. Source SHA-256: `1d96ad64ae629fd58c46b34431915c3d2ce8d9111a2b86fdd0f59fcbbbe7a6ae`.
- Processing: Blender 5.2.1 weld/decimation and high-poly tangent-normal baking for two LODs; glTF Transform 4.5.0 deduplication/pruning/packaging, 1024px WebP maps (quality 90), and Meshopt compression. Original color/roughness/metallic detail is retained and resized; normals are baked per LOD. No new third-party artwork.
- Budgets: 29,790 / 9,930 triangles; camera distances 0 / 26 meters with 10% hysteresis; 1.66 MiB total versus 59.21 MiB source. Runtime SHA-256: `cc9d2dd45a995992f7a84f07c47202cc53881d3da8a145ff4017f3fd079c4903`.
- Reproduction: [asset pipeline instructions](scripts/model-assets/README.md), [Blender bake](scripts/model-assets/bake-rare-enemy.py), [glTF packaging](scripts/model-assets/optimize-rare-enemy.mjs).
- Usage: same project-owned/user-supplied permission as the original rare enemy. The high-poly source and bake intermediates stay outside the release payload.
# Minion and Summoning Pit runtime derivatives

- Imp: Quaternius **Bestiary – Dungeon Monsters Kit [Standard]**, supplied by the project owner. Governed by the included **Quaternius Asset License (QAL) v1.0, 2026-08-28**, not CC0. Used here as part of the game; standalone asset redistribution is not granted. Original GLB SHA-256: `cfc689f3162f0cfe72d0d4637ae348dc54b3e34083b1c96d2721b95176186df0`. The original pack/license stays under `authoring/local/assets/Bestiary - Dungeon Monsters Kit[Standard]/`.
- Runtime `imp.glb`: 1.5 m tall, grounded, +Z forward, 55 joints, 15,232 triangles, 512px embedded maps. The supplied GLB and FBX contain **no animation clips**; idle/move/attack/hit use procedural view motion and death removes the view. No third-party animation is claimed. The three supplied numbered base-color maps are shipped as `imp-variant-1.jpg` through `imp-variant-3.jpg`, matching persisted variant IDs (red, green, blue).
- Pit: project-owner-supplied `authoring/local/assets/models/Summonning_pit.glb`, SHA-256 `22208e651e2b5894a9161003847f11ac4eecc6ab5aee2a0ff63ed6c74e547c6e`. Included for Infuse: Evergrowth under the owner's direction; no broader redistribution license is asserted. Runtime `summoning-pit.glb`: 3 m diameter, grounded pivot, 7,806 triangles and 512px embedded maps.
- Reproduction: `scripts/world-assets/prepare-minions.py` runs in isolated background Blender, preserves editable sources and audit hashes under `authoring/local/minions/`, and writes only curated derivatives under `public/assets/world/shared/models/`. Raw sources and the full pack are not shipped.

## Greenhaven foliage dressing (September 2026)

- Six small runtime GLBs (`greenhaven-grass-patch`, `greenhaven-shrub-a/b`,
  `greenhaven-mushrooms`, `greenhaven-fallen-log`, `greenhaven-stump`) derive from
  [Kenney's Nature Kit](https://kenney.nl/assets/nature-kit), CC0 1.0.
- Original source models: `grass`, `plant_bushSmall`, `plant_bushDetailed`,
  `mushroom_redGroup`, `log`, and `stump_roundDetailed`. The grass patch arranges
  ten copies of the original clump around a trunk opening. Geometry is fitted to
  metres with ground pivots and a modest meadow palette adjustment.
- Download: `https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip`.
  Archive SHA-256: `fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d`.
  Upstream notice: `public/assets/world/shared/licenses/kenney-nature-cc0.txt`.
- Rebuild with `scripts/world-assets/prepare-greenhaven-dressing.py`, then
  `scripts/world-assets/optimize-greenhaven-dressing.mjs`. The isolated editable
  source stays at `authoring/local/greenhaven/greenhaven-dressing.blend`.
  Existing Greenhaven pines and village props retain their documented provenance.
