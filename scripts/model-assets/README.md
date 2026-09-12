# Rare enemy runtime asset

The shipped GLB has two static nodes (`Rare_LOD0`, `Rare_LOD1`) sharing color/PBR textures, with a separate baked normal map per level. `extras.lodDistance` supplies the camera distances consumed by `ModelLod.ts`. All levels preserve the source pivot/orientation; the existing height normalization is applied once before creating the Three.js LOD group. Collision stays authored and independent of visual geometry.

Rebuild with Blender 5.2.1 and an authoring-only Node installation containing `@gltf-transform/core`, `@gltf-transform/extensions`, and `@gltf-transform/functions` 4.5.0, `meshoptimizer` 1.0.1, `ndarray-pixels` 5.2.0 and its Sharp dependency. Do not add these tools to the game's runtime bundle. `--tool-root` is the directory containing that installation's `package.json` and `node_modules`. Windows must use a single Sharp/libvips version; the packager uses the same Sharp as `ndarray-pixels`.

1. Restore the original `public/assets/models/enemies/enemy-rare.glb` from Git commit `e238e13` into `authoring/local/rare-enemy/source.glb`, preserving binary bytes. Its SHA-256 is recorded in `ASSET-LICENSES.md`.
2. Run `blender --background --factory-startup --python scripts/model-assets/bake-rare-enemy.py -- <absolute-source.glb> <absolute-lods.glb>`. This runs in an isolated, disposable Blender scene. Keep intermediates under `authoring/local/`.
3. Run `node scripts/model-assets/optimize-rare-enemy.mjs --tool-root <authoring-tools> <lods.glb> <optimized.glb>`.
4. Inspect all levels under the same lighting/camera, then copy the result to `public/assets/models/enemies/enemy-rare-lods-v1.glb`. A later incompatible rebuild should change the asset URL. Run the production build and release validation.

The 2026-09-12 result is 1.66 MiB, with 29,790 / 9,930 triangles. Rebuilding the normal bake may change binary hashes across tool versions. The geometric target ratios are 1.5% / 0.5%; topology can stop decimation above its requested ratio. Compare actual counts and appearance before promotion.
