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
- The existing project-supplied fountain and woodland bridge retain their original provenance above.

## Highwood terrain and woodland

- Files: `public/assets/world/shared/models/highwood-*.glb`.
- The rock formations, worn path stones and dry undergrowth were authored through Blender MCP from `Layout.png`. Their renderer-neutral footprints and paths are in `src/data/world/highwood.json`. The existing Poly Haven forest material remains the walkable ground and loading fallback.
- The three leafless trees reuse Kay Lousberg's CC0 Forest Nature Pack models `Tree_Bare_1_A_Color1`, `Tree_Bare_1_B_Color1`, and `Tree_Bare_2_A_Color1` from the existing local archive. The source archive SHA-256 is `2ee83e63bb7695f2d884ec27ddf6fce020789a452e7d5c5b0bbdfc4f6ea1fc8c`. Geometry is scaled to meters and recolored as weathered bark. The supplied license is retained as `shared/licenses/kaykit-highwood-cc0.txt`.
- The two shaded pines are palette variants of the project's existing Greenhaven pine geometry.
- The timber lookout reuses Quaternius's [Small Watch Tower](https://poly.pizza/m/CygapExMf5), from [Ultimate Fantasy RTS](https://quaternius.com/packs/ultimatefantasyrts.html), released under CC0 1.0. Downloaded September 11, 2026 from `https://static.poly.pizza/8bec6466-329a-4f83-99d9-600a00e2c437.glb`; source SHA-256: `697dbc949daa279858e3e4ebed1b3039137bfb9e5be97d783be323a7786dd27f`.
- Its pointed roof reuses `roof-point.glb` from Kenney's [Fantasy Town Kit](https://kenney.nl/assets/fantasy-town-kit), CC0 1.0, already in the local asset library. The source archive SHA-256 is `1a7530c09f4d2fa2cdee259876f089334f8b1f27fa86a0c4f54ef86cdd8676ef`. The supplied notice is retained as `shared/licenses/kenney-fantasy-town-cc0.txt`.
- Reproduction: `scripts/world-assets/export-highwood.py` exports seven self-contained, vertex-colored GLBs and the editable `authoring/local/highwood/highwood.blend`. Imports are isolated from other open Blender scenes; only the selected authored scene is exported. The lookout is batched to one material with its roof, and source hashes are checked before conversion.
