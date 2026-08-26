# Slice 12D1 — Constrained KayKit in-game proof

## Why this slice exists

The external asset evaluation is complete enough to make one controlled in-game attempt before requiring a visual desktop authoring tool such as Crocotile or Blender.

This is **not** another whole-world beauty pass. Previous attempts failed because Codex was asked to invent scenery from primitive Three.js geometry and to make too many artistic layout decisions at once. This proof removes most of that freedom: use only user-selected real KayKit assets, keep the already-working world topology, and prove that those assets materially improve the actual phone view.

If this proof still reads as a blockout despite using the selected real assets, stop further code-authored environment composition and wait for an external visual authoring workflow.

## Source references

Read before implementation:

- `AGENTS.md`
- `WIP/environment-layout-blueprint.svg`
- `WIP/external-environment-evaluation/README.md`
- the three inventories/contact-sheet directories under `WIP/external-environment-evaluation/`
- the original ZIPs under `WIP/external-environment-source-archives/`

Do not guess asset filenames. Use exact source names from the inventories.

---

# User-approved asset language

## Dungeon Pack 1.1 FREE

### General outdoor props

Use all barrel variants as occasional outdoor props in Areas 1–3:

- `barrel_large.gltf`
- `barrel_large_decorated.gltf`
- `barrel_small.gltf`
- `barrel_small_stack.gltf`

Do not scatter them uniformly. Put them in small believable groups near paths, bridge approaches, walls, or activity points.

### Optional paved/boarded surface

The `floor_wood_*` family is approved as a possible small pavement/road treatment in Area 1 or Area 2:

- `floor_wood_large.gltf`
- `floor_wood_large_dark.gltf`
- `floor_wood_small.gltf`
- `floor_wood_small_dark.gltf`

For this proof, **do not build a complex branching road network from these pieces**. At most use a short, straight or gently stepped approach/boardwalk where connectivity is trivial and visually obvious (for example near the A1↔A2 bridge). Main world navigation remains defined by the existing topology.

### Area 1 west boundary

Use:

- `rubble_half.gltf`
- `rubble_large.gltf`

These supplement the large Forest Nature rocks at the western high-ground boundary. They must not form a repeated straight chain.

### Area 3 fortress walls

The Dungeon wall family is the approved structural language for Area 3. Use a varied mix led by:

- `wall.gltf`
- `wall_cracked.gltf`
- `wall_broken.gltf`
- `wall_corner.gltf`

Related wall-family pieces may be used only when they clearly solve an opening/corner/gate requirement and match the selected language.

Important camera rule: do **not** rebuild a tall opaque south foreground wall. South/foreground Area 3 remains cutaway, low, broken, or open so the portrait camera cannot sit behind a wall. Tall wall mass belongs primarily on the A1↔A3 eastern frontier, the far/north side, and the far/east side.

---

## Forest Nature Pack 1.0 FREE

### Rocks

All rock families may be used for variation, with strong preference for the large `Rock_1` forms:

- `Rock_1_J_Color1.gltf`
- `Rock_1_K_Color1.gltf`
- `Rock_1_L_Color1.gltf`
- `Rock_1_M_Color1.gltf`

These four should be the dominant large western-border forms. Mix other smaller rocks around their bases. Randomize rotation and modestly vary scale. Never produce a regular evenly spaced line of identical boulders.

### Bushes and grass

All `Bush_*_Color1.gltf` families and double-sided `Grass_*_Color1.gltf` variants are approved for mixed use.

Use deterministic seeded scatter so reloads are stable. Scatter should be denser near borders/landmarks and lighter in combat clearings, gates and main movement corridors.

Do not place vegetation inside:

- gate openings and approaches;
- the central Area 1 combat clearing;
- spawn circles / immediate spawn movement zones;
- the bridge deck;
- narrow Area 3 corridors.

### Area 1 trees

Use the Tree 4 family as the primary Area 1 tree language:

- `Tree_4_A_Color1.gltf`
- `Tree_4_B_Color1.gltf`
- `Tree_4_C_Color1.gltf`

Place them in clusters/patches rather than a uniform grid. Keep the central combat floor readable.

### Area 2 trees

Use the bare-tree families as the dominant Area 2 vegetation language:

- `Tree_Bare_1_A_Color1.gltf`
- `Tree_Bare_1_B_Color1.gltf`
- `Tree_Bare_1_C_Color1.gltf`
- `Tree_Bare_2_A_Color1.gltf`
- `Tree_Bare_2_B_Color1.gltf`
- plus any remaining `Tree_Bare_*_Color1.gltf` variants present in the inventory.

Area 2 should immediately read as a darker/less healthy continuation of Area 1 without relying on primitive recolored geometry.

---

## Medieval Builder Pack 1.0

### A1↔A2 bridge

`bridge.gltf.glb` is approved as the physical bridge/crossing over the north lake.

Align it to the existing A1↔A2 crossing. Preserve gameplay/collision authority. The visible bridge should replace primitive bridge/causeway presentation where possible.

### Area 1 forest patch

`forest.gltf.glb` is approved for a small number of dense tree patches around Area 1's non-combat edges. It supplements, rather than replaces, the individually placed Tree 4 assets.

### Tile families deliberately deferred

The remaining Medieval Builder square/hex road, terrain, and water families are **not part of this proof**, except where a single trivial tile is necessary under the bridge and can be validated visually.

Reason: they require coherent edge matching and artistic route composition. Do not ask Codex to freely arrange a full tile network now.

When desktop visual authoring is available, evaluate these tile families in Crocotile/Blender (or another existing compatible editor) instead of writing a custom Infuse level editor.

---

# What Codex should implement now

## Phase 1 — Curated runtime import

1. Extract/copy only the selected models and their required textures/material dependencies from the source ZIPs into a clean runtime asset hierarchy, e.g. `public/assets/kaykit/...`.
2. Record KayKit CC0 provenance in the existing asset-license/provenance documentation.
3. Do not ship the source ZIPs as runtime payload.
4. Preserve shared texture-atlas reuse for Dungeon and Forest Nature.
5. Keep asset loading Vite-base-aware and cosmetic-failure-safe.

## Phase 2 — One Area 1 phone-view proof

Build one representative Area 1 composition first. Do not try to finish Area 1–3 simultaneously.

Target an ordinary gameplay position in central/northern Area 1 where a 390×844 portrait view can show several of the following at once:

- Tree 4 cluster(s);
- mixed bushes/grass;
- varied Forest Nature rocks;
- one or two barrel groups;
- a readable open combat floor;
- the route toward the north crossing;
- if visible from the chosen position, the real Medieval Builder bridge.

The screenshot must look materially different from Slice 11B: real textured/atlas-backed asset surfaces should dominate the environment instead of exposed boxes/icosahedrons/circles.

For this proof, it is acceptable for the underlying broad grass/water surface to remain simple. The question being tested is whether the selected real assets and composition can create a convincing gameplay screen without desktop manual authoring.

## Phase 3 — Two small structural proofs

Only after Phase 2 is working:

1. **West boundary:** replace one representative visible stretch of the old procedural west border with a layered composition of Rock_1_J/K/L/M + smaller rocks + `rubble_half`/`rubble_large`. Keep large masses mostly outside the playable edge and never obscure the hero across most of the portrait screen.
2. **Area 3 wall:** replace one representative visible wall stretch with real Dungeon wall modules (`wall`, cracked, broken, corner). Keep the south foreground cutaway rule intact.

Do not rebuild all borders/world decoration in the same PR unless these representative segments already pass screenshot review.

---

# Placement rules

This proof may use a small data-driven placement table plus seeded scatter for vegetation. Do not turn `EnvironmentView.ts` back into hundreds of hand-authored primitive calls.

Recommended split:

- explicit placements: bridge, wall segments, large rocks/rubble, barrel groups, forest patch;
- deterministic seeded scatter within authored allowed regions: bushes, grass, small rocks, some trees;
- invisible gameplay collision: keep existing runtime/domain authority.

The scatter algorithm must support exclusion regions for roads/gates/combat/spawns. It must not change every reload.

No custom visual level editor is requested.

---

# Explicit non-goals

Do not in this proof:

- use procedural visible boulders/walls to fill missing scenery;
- rebuild the full Medieval Builder tile map;
- adopt hex-world topology;
- change combat/progression/save behavior;
- change area coordinates/gate topology;
- finish all of Area 2 or Area 3;
- build an Infuse-specific editor;
- switch away from Three.js;
- claim the whole environment is solved because assets load successfully.

---

# Acceptance / stop criteria

Capture portrait screenshots from:

1. the selected Area 1 showcase position;
2. the representative west-border segment;
3. the representative real Area 3 wall segment.

Pass if:

- real KayKit asset materials/textures are clearly visible;
- Area 1 feels significantly denser and less geometric;
- repeated objects have convincing variation;
- the hero/combat floor stays readable;
- no giant foreground occlusion is introduced;
- the bridge/wall/rocks look like authored models rather than primitive substitutes.

If the screenshots still read as a crude blockout, **stop code-authored beauty work**. The next environment step is desktop visual composition in an existing tool such as Crocotile or Blender. Do not respond by adding more procedural geometry.

If this proof passes, continue iteratively with the same asset language while deferring complex Medieval Builder road/water tile networks until they can be visually authored or explicitly tile-mapped.