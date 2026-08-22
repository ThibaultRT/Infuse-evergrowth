# Quaternius asset implementation audit

## Decision

Use **Quaternius as the primary 3D asset family** for environment, characters, equipment and animation. The official creator pages mark the relevant Standard packs as **CC0 1.0**, including commercial use, with no attribution requirement.

Do **not** commit the original full ZIP archives to the runtime application. Keep only the selected runtime models/textures required by the current areas and character variants, preferably converted to optimized `.glb` files.

## Official packs selected

| Purpose | Pack | Official page | Free Standard archive | Official formats |
| --- | --- | --- | ---: | --- |
| Area 1 village structures / ruins | Medieval Village MegaKit | https://quaternius.com/packs/medievalvillagemegakit.html | 153 MB | FBX, OBJ, glTF |
| Trees / rocks / flowers / plants | Stylized Nature MegaKit | https://quaternius.com/packs/stylizednaturemegakit.html | 99 MB | FBX, OBJ, glTF |
| Weapons / fences / tools / props | Fantasy Props MegaKit | https://quaternius.com/packs/fantasypropsmegakit.html | 143 MB | FBX, OBJ, glTF |
| Base humanoid body / heads / hair | Universal Base Characters | https://quaternius.com/packs/universalbasecharacters.html | Standard/free tier | FBX, glTF |
| Modular medieval/fantasy outfits | Modular Character Outfits - Fantasy | https://quaternius.com/packs/modularcharacteroutfitsfantasy.html | Standard/free tier | FBX, glTF |
| Shared humanoid animation | Universal Animation Library | https://quaternius.com/packs/universalanimationlibrary.html | Standard/free tier | FBX, GLB |
| Later combat animation expansion | Universal Animation Library 2 | https://quaternius.com/packs/universalanimationlibrary2.html | Standard/free tier | FBX, glTF |

All of the above are published by Quaternius as CC0 and may be used in proprietary commercial projects.

## Findings relevant to Three.js

### Character/rig compatibility

The Universal Base Characters use a shared humanoid rig and are explicitly compatible with the Universal Animation Library. Quaternius states an average of roughly 13k triangles per base character, which is reasonable for our mobile target provided we keep visible character counts controlled and share textures/materials where possible.

The Fantasy Outfit pack is built on the same rig and is explicitly compatible with the Base Characters and Universal Animation Library. This is the key reason to prefer Quaternius over KayKit for the main character pipeline: the outfit pieces support the equipment-driven appearance we want.

A public Three.js implementation using these same CC0 Quaternius packs confirms a practical runtime pattern:

- load base/outfit glTF with `GLTFLoader`;
- clone rigged instances with `SkeletonUtils.clone`;
- load the Universal Animation Library once and share its `AnimationClip`s between compatible characters;
- map bones by name for modular/skinned attachments;
- attach weapons to the right/left hand bone (`hand_r` / corresponding left-hand bone);
- use `THREE.AnimationMixer` per character instance;
- keep animation clips separate from gameplay timing.

This fits our existing architecture: `HeroView` / `EnemyView` own visual rigs and mixers while combat systems remain authoritative.

### Animation clips useful for Infuse

The first Universal Animation Library contains locomotion, death and combat actions. A working Three.js consumer of the Standard library resolves names such as:

- `Idle_Loop`
- `Jog_Fwd_Loop`
- `Death01`
- `Sword_Attack`
- `Punch_Jab`
- `Punch_Cross`
- sitting / interaction / spell clips

Exact clip names must be re-audited from the downloaded Standard GLB before implementation; visual code should provide an alias map rather than scatter literal animation names through gameplay code.

For Infuse, the initial curated set should be small:

- idle
- locomotion forward
- unarmed punch A/B
- 1H slash
- 1H stab
- heavy/chop attack if available
- hit/reaction if available
- death
- resurrection/stand-up candidate if available

Do not ship the complete animation library to the browser merely because it is present in the source archive.

## Proposed repository layout

```text
public/assets/quaternius/
├── characters/
│   ├── hero-base.glb
│   ├── enemy-base.glb
│   ├── outfits/
│   │   ├── leather-starter.glb
│   │   ├── common.glb
│   │   ├── uncommon.glb
│   │   ├── rare.glb
│   │   ├── epic.glb
│   │   └── legendary.glb
│   └── animations/
│       └── humanoid-core.glb
├── weapons/
│   ├── sword-*.glb
│   ├── hammer-*.glb
│   └── spear-*.glb
├── area-1/
│   ├── trees/
│   ├── rocks/
│   ├── flowers/
│   ├── fences/
│   ├── ruins/
│   ├── road/
│   └── gate/
└── LICENSE.md
```

The filenames above are **runtime aliases**, not assumptions about the original Quaternius filenames. The import/build step should map selected source filenames to stable game-facing names.

## Asset loading architecture

Add a reusable `AssetLoader` rather than loading GLB files directly inside `Game.ts`.

Recommended responsibilities:

1. resolve URLs using Vite's production base;
2. cache parsed GLTF assets and shared animation libraries;
3. expose cloning helpers for skinned meshes using `SkeletonUtils.clone`;
4. return explicit errors/fallbacks if an asset is missing;
5. optionally preload Area 1 / hero essentials before play and defer later-area assets;
6. keep source asset IDs/data mapping outside rendering implementation.

`HeroView` should compose:

- one base body/head rig;
- modular torso/legs/helmet visual parts;
- independently attached left/right weapons;
- eventually orbit weapon scene objects;
- one mixer using shared clips.

Do not bake both hand weapons into a single character asset. Each hand remains an independent gameplay attack source and the visual weapon/attack animation must follow the corresponding hand event/state.

## Environment implementation recommendation

Do not replace `EnvironmentView` with one giant exported scene. Use individual props or small reusable clusters so we retain culling, authored placement and data-driven areas.

For Area 1, start with a deliberately small subset:

- 3-4 tree variants;
- 3-5 rock variants;
- 3 flower/plant variants;
- 1-2 fence variants;
- a few stone wall/ruin pieces;
- road/path pieces or a material/mesh solution compatible with the winding path;
- one physical medieval gate assembly;
- 2-4 small medieval props for landmarks.

Repeated props should reuse loaded geometry/materials and use instancing where it materially lowers draw calls.

## Texture/runtime budget

The creator pages do not consistently publish exact texture dimensions for the modern packs, so inspect the real Standard archives before setting final limits.

Initial runtime policy for iPhone 12:

- prefer 512-1024 px shared color textures for normal gameplay assets;
- retain higher resolution only where a real phone-scale comparison proves useful;
- convert textures to KTX2/Basis later if the benefit is measurable;
- use Meshopt/Draco only after measuring decoding cost vs payload benefit on Safari;
- avoid shipping unused alternate colors, source scenes or duplicate FBX/OBJ copies;
- track total initial asset transfer separately from the full downloadable game payload.

## Licensing record

Quaternius official pages state CC0 / free commercial use. Attribution is not required. Still retain an internal record for provenance:

- creator: Quaternius
- official pack URL
- pack name
- source archive/version/date downloaded
- source filename -> runtime filename mapping
- CC0 1.0 license
- any transformations performed

This record is for project hygiene and future proprietary distribution audits, not because attribution is legally required.

## Current download limitation

The free Standard archives are delivered by itch.io through its interactive `No thanks, just take me to the downloads` flow. The current GitHub/web tooling can inspect the official pages but cannot complete that interactive binary download and push the resulting ZIP contents directly into this repository.

When the Standard ZIPs are available locally/uploaded to the working session, perform the next pass:

1. inventory every glTF/GLB and texture;
2. record dimensions, file sizes, meshes, materials, bones and animation clips;
3. preview candidate assets;
4. select the Area 1 + starter-character subset;
5. convert selected glTF + external buffers/textures to runtime GLB where useful;
6. optimize and measure the selected files;
7. commit only that runtime subset plus the license manifest;
8. implement `AssetLoader`, then replace procedural placeholders incrementally.

## Implementation order

1. Import/inspect Standard ZIPs.
2. Hero base + starter leather outfit + idle/run animation proof-of-concept.
3. One sword/hammer/spear attachment proof-of-concept for each hand.
4. Area 1 tree/rock/flower/ruin proof-of-concept in `EnvironmentView`.
5. Physical gate assembly.
6. Enemy outfit rarity variants using the same humanoid rig.
7. Optimize payload and draw calls before expanding the asset catalog.
