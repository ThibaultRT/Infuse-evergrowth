# Quaternius asset inspection and runtime import plan

## Scope

This inspection is based on the actual Standard ZIP archives supplied for Infuse: Evergrowth:

- Medieval Village MegaKit [Standard]
- Stylized Nature MegaKit [Standard]
- Fantasy Props MegaKit [Standard]
- Universal Base Characters [Standard]
- Modular Character Outfits - Fantasy [Standard]
- Universal Animation Library [Standard]
- Universal Animation Library 2 [Standard]

Every included archive contains a Quaternius license file declaring **CC0 1.0 Universal / Public Domain Dedication**. Attribution is not required. Keep the creator/pack/source records below for provenance even though the license does not require credits.

## What the free Standard archives actually contain

| Pack | ZIP size | Relevant Standard content | Source formats | Source texture sizes |
| --- | ---: | --- | --- | --- |
| Medieval Village MegaKit | 153.54 MiB | 176 glTF models plus matching FBX/OBJ; walls, floors, doors, fences, modular village parts | glTF + BIN, FBX, OBJ/MTL | mostly 2048², some 512²/1024²/4096² |
| Stylized Nature MegaKit | 99.27 MiB | 68 glTF models; trees, rocks, bushes, flowers, grass, rock paths | glTF + BIN, FBX, OBJ/MTL | mostly 1024²/2048² |
| Fantasy Props MegaKit | 143.25 MiB | 94 glTF models; furniture/props plus bronze sword/axe and wooden shield | glTF + BIN, FBX, OBJ/MTL | mostly 2048², a few 4096² |
| Universal Base Characters | 122.99 MiB | male/female full-body universal-rig characters plus hair/eyebrow assets | glTF + BIN, FBX | mostly 2048² |
| Modular Character Outfits - Fantasy | 280.71 MiB | free subset contains **Peasant and Ranger only**, male/female, plus modular parts | glTF + BIN, FBX | outfit maps are 4096²; body maps 2048² |
| Universal Animation Library 1 | 15.17 MiB | 43 animations, root-motion and non-root-motion variants | GLB, FBX | no runtime character textures required |
| Universal Animation Library 2 | 17.87 MiB | 43 additional animations, root-motion and non-root-motion variants | GLB, FBX | no runtime character textures required |

The marketing preview for Modular Character Outfits shows many more outfits than the free Standard archive. Do not design progression assuming those armor sets exist in the free pack.

Likewise, the Standard Fantasy Props archive contains `Sword_Bronze`, `Axe_Bronze` and `Shield_Wooden`, but **no hammer or spear model**. The current five hammer/five spear gameplay definitions therefore still need another visual source or bespoke models.

## Rig and animation compatibility

The outfit/base-character glTFs and UAL libraries use the same universal skeleton naming. The inspected outfit skin has 65 joints; important bones include `pelvis`, `hand_l`, `hand_r`, leg/foot chains and finger chains. The animation GLBs expose the same node names, so the initial Three.js implementation does not need an external retargeting pipeline.

Use the **non-root-motion** `UAL1_Standard.glb` first. Infuse already owns world movement and combat scheduling, so root motion would fight gameplay state.

UAL1 Standard contains 43 clips. The directly useful first-pass clips are:

- `Idle_Loop` — 2.5 s
- `Jog_Fwd_Loop` — 0.933 s
- `Walk_Loop` — 1.333 s
- `Death01` — 2.4 s
- `Hit_Chest` / `Hit_Head`
- `Punch_Jab` — 0.867 s
- `Punch_Cross` — 1.0 s
- `Sword_Attack` — 1.533 s
- `Sword_Idle` — 1.667 s

UAL2 adds another 43 clips including `Sword_Regular_A/B/C`, `Sword_Regular_Combo`, `Sword_Heavy_Combo`, `Sword_Block`, `Sword_Dash`, `Melee_Hook`, `Zombie_Idle_Loop`, `Zombie_Walk_Fwd_Loop` and `Zombie_Scratch`. Do not ship UAL2 until a feature actually consumes those clips.

## Character cost and practical implication

Measured from the actual glTF accessors:

| Model | Approx. triangles | Skinned meshes | Height |
| --- | ---: | ---: | ---: |
| Male Ranger outfit | 26,982 | 9 | 1.87 m |
| Male Peasant outfit | 12,894 | 4 | 1.56 m clothing extent |
| Female Ranger outfit | 26,966 | 9 | 1.80 m |
| Female Peasant outfit | 13,568 | 4 | 1.53 m clothing extent |
| Superhero Male full body | 14,318 | 3 | 1.82 m |

The outfit README explicitly says only the base character **head** should be used under clothing; using the full body causes clipping and wastes work. The Standard archive, however, only provides full-body glTF characters. For a quick prototype, a full-body graft can work, but before populating Area 1 with many humanoids we should create a head/eyes/skin-only runtime derivative rather than render a hidden full body under every outfit.

`Male_Ranger.gltf` is already split into named skinned meshes such as `Male_Ranger_Body`, `Male_Ranger_Legs`, `Male_Ranger_Feet_Boots`, `Male_Ranger_Head_Hood` and `Male_Ranger_Acc_Pauldron`. This is useful for equipment-driven visibility: hood and pauldron can be independently shown/hidden without changing gameplay state.

## Environment candidates verified from the actual files

### Bright Area 1 nature

Recommended first subset from Stylized Nature:

- `CommonTree_1.gltf` — 6,265 tris, ~7.26 m tall
- `CommonTree_3.gltf` — 3,505 tris, ~9.43 m tall
- `Rock_Medium_1.gltf` — 342 tris
- `Rock_Medium_2.gltf` — 244 tris
- `Bush_Common_Flowers.gltf` — 1,368 tris
- `Flower_3_Group.gltf` — 755 tris
- `Grass_Common_Short.gltf` — 155 tris
- `RockPath_Round_Wide.gltf` — 3,500 tris, ~2.1 m tile

The nature art direction matches the bright, saturated, stylized starting area very well. Trees are more detailed than the current procedural primitives without becoming photorealistic.

### Fences, ruins and gate

Recommended first subset from Medieval Village:

- `Prop_WoodenFence_Single.gltf` — 40 tris, ~2.06 m span
- `Prop_WoodenFence_Extension1.gltf` — 32 tris
- `Prop_Brick1.gltf` — 108 tris for ruin scatter
- `Floor_UnevenBrick.gltf` — four triangles, 2 m × 2 m tiled stone surface
- `DoorFrame_Round_Brick.gltf` — 2,046 tris, ~1.6 × 2.59 m
- `Door_4_Round.gltf` — 1,228 tris, ~1.11 × 2.32 m

`DoorFrame_Round_Brick` + `Door_4_Round` is a viable **physical gate prototype** for the current boss-gated passage concept. The door mesh itself can rotate around a parent pivot when unlocked; rendering remains a projection of the gameplay gate state.

### Weapon proof-of-concept

`Sword_Bronze.gltf` is 1,540 triangles and ~1.13 m long. Its model origin is close to the grip (Y range approximately -0.21 to +0.92), making it practical to attach to `hand_l` or `hand_r` with a small authored orientation/offset.

Do not map the bronze axe to the hammer class merely because it is available. Keep missing hammer/spear visuals explicit until appropriate assets are selected.

## Runtime subset prepared during this inspection

A curated runtime package was generated locally from the supplied archives with these rules:

- source ZIPs are not included;
- glTF geometry/UVs are unchanged;
- only the models listed above plus Male Ranger, Male Peasant, Superhero Male and `UAL1_Standard.glb` are included;
- referenced 2K/4K PNG textures are resized to a maximum of **1024 px** for the browser/mobile target;
- shared textures remain external to the glTF models so repeated trees/fences/outfits reuse cached files instead of embedding duplicate images in every GLB;
- the non-root-motion animation library is used;
- the two incorrect image URIs in the Standard male base glTF (`*_png.png`) are corrected to the actual PNG filenames.

The resulting runtime subset is about **37.9 MiB** unzipped / **31 MiB** zipped, broken down roughly as:

- animations: 7.27 MiB
- characters: 14.13 MiB
- nature: 6.35 MiB
- village/gate: 7.19 MiB
- sword: 2.97 MiB

This is far below the combined source archive size and should be loaded lazily by area/feature. It should not all be fetched during first paint.

## Proposed repository layout

```text
public/assets/quaternius/
├── manifest.json
├── README.md
├── animations/
│   └── UAL1_Standard.glb
├── characters/
│   ├── models/
│   │   ├── Male_Ranger.gltf + .bin
│   │   ├── Male_Peasant.gltf + .bin
│   │   └── Superhero_Male_FullBody.gltf + .bin
│   └── textures/
├── nature/
│   ├── models/
│   └── textures/
├── village/
│   ├── models/
│   └── textures/
├── weapons/
│   ├── models/Sword_Bronze.gltf + .bin
│   └── textures/
└── licenses/
    └── one source license record per inspected pack
```

## Recommended Three.js implementation

1. Add a rendering-only `AssetLoader` using `GLTFLoader`; cache promises by asset URL so shared models/textures are never loaded twice.
2. Load static environment assets once per area and clone ordinary `Object3D` trees/rocks/fences as needed. Use `InstancedMesh` later for repeated non-skinned props if draw calls become material.
3. Clone rigged humanoids with `SkeletonUtils.clone`, not `Object3D.clone`, so each entity receives a valid independent skeleton.
4. Reuse one loaded `UAL1_Standard.glb` animation clip catalog across all compatible humanoids. Create one `AnimationMixer` per animated visible humanoid.
5. Keep gameplay movement authoritative. Animation selects Idle/Jog/Attack/Death based on runtime state but never moves or damages entities by itself.
6. Attach hand weapons to `hand_l`/`hand_r`. Both hand visuals must remain independent because gameplay already schedules both hand attacks independently.
7. Before replacing every Area 1 enemy with a skinned model, create a head-only base-character derivative and consider animation LOD: only advance mixers for the active area, and reduce/stop animation work for distant passive enemies if profiling requires it.
8. Build `GateView` from the brick frame + wooden door. The gameplay gate owns open/locked state; `GateView` only animates the physical opening.
9. Keep procedural fallback visuals until each asset path has loaded successfully; failed cosmetic loading must not break gameplay or saves.

## Decision

The inspected Quaternius Standard assets are suitable to begin the real graphical replacement work. The strongest immediate implementation order is:

1. static Area 1 environment assets;
2. physical gate;
3. one Ranger hero + UAL1 locomotion;
4. Peasant common enemies + animation;
5. hand-attached bronze sword;
6. then solve head-only optimization and source proper hammer/spear visuals before broad equipment rendering.
