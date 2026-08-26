# 2 — Environment production

## Outcome

Replace topology-proof/blockout scenery across Areas 1–3 with a coherent, camera-safe, authored environment while retaining continuous travel and current progression semantics.

## Current decisions

- The three-area topology and physical connections are accepted; do not redesign them during art production.
- KayKit Medieval Builder is the primary outdoor language, Dungeon is the structural/ruin supplement, and Forest Nature is the vegetation/rock supplement. The evaluated packs are CC0; provenance remains in `ASSET-LICENSES.md`.
- Runtime imports must be curated rather than copying source archives. Prefer glTF/GLB, shared atlases/materials, instancing, and Vite-base-aware URLs.
- Tall foreground scenery must remain camera-safe through cutaway composition and the existing environment-occlusion presentation helper.

## Delivery stages

1. Convert the accepted asset proof into a reusable placement/authoring vocabulary: naming, scale, pivots, collision metadata, material policy, and performance budget.
2. Produce one portrait-quality Area 1 view containing a readable path, forest edge, west ridge, lake causeway, and restrained prop dressing.
3. Rebuild Area 3 as a ruined fortress with low camera-facing fragments, taller far silhouettes, readable gates, rooms/corridors, and spawn layouts that match those spaces.
4. Give Area 2 a distinct ashwood identity and finish ground/shore/rift transitions across the shared world.
5. Validate all boundaries and gates from both directions, then profile on the target phone before scaling density.

## Constraints

Gameplay collision remains engine-neutral and must not be inferred from rendered meshes. Cosmetic asset failure must retain playable fallbacks. Keep source archives and evaluation artifacts out of runtime delivery; retain only selected runtime assets and license records.
