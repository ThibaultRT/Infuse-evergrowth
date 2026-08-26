# Third-party asset licenses

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

Runtime selections and future asset work are summarized in `2-environment.md`; exact shipped files are recorded by their runtime manifests.

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
