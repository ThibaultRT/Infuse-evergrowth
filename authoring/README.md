# World authoring workspace

The game world is authored as renderer-neutral TypeScript under `src/data/world/`.
Those layouts are the only source of placement transforms. The renderer and the
pure collision compiler consume the same named placements.

## Local development library

Run:

```bash
npm run authoring:assets:capture -- another-example
npm run authoring:assets:audit -- another-example
```

The capture command validates the prototype shape, preserves all public assets and
their relative dependencies, copies reference renders/source/provenance, backs up
the prior local Three.js Editor source, and writes SHA-256 plus byte size for every
captured file.

While the source folder exists, the audit verifies both capture integrity and exact
source parity. After `another-example/` is deliberately deleted, the same audit
continues to verify every preserved file against the captured SHA-256 inventory.

```text
authoring/local/world-development/
├─ source-assets/another-example-public-assets/
├─ references/
│  ├─ Layout.png
│  ├─ general-layout.png
│  ├─ iphone-preview.png
│  ├─ world-layout.glb
│  └─ prototype-source/
├─ provenance/
│  ├─ ASSET-LICENSES.md
│  └─ upstream-license-files/
├─ legacy-three-editor-source/
└─ inventory.json
```

`authoring/local/` is ignored by Git. Never flatten raw glTF trees or use this
directory from production code. Keep irreplaceable local creative sources backed up
outside the repository.

## Runtime promotion

`src/data/world/world-assets.json` maps semantic asset keys to captured source paths
and normalized runtime filenames. Promote the active catalog with:

```bash
npm run authoring:assets:promote -- --all
npm run authoring:assets:verify
```

Source `.gltf` dependency trees are repacked as self-contained GLBs. Only assets
referenced by accepted layouts belong under `public/assets/world/`; the generated
manifest records source/runtime hashes. Do not copy full packs into `public/`.

## Preview, validation and debug GLB

```bash
npm run authoring:viewer
npm run authoring:world:validate
npm run authoring:world:capture
```

The browser preview uses the production `WorldBuilder` and
`WorldCollisionCompiler`. It provides chunk visibility, asset resolver switching,
stable-name search/picking, collider/spawn/gate-clearance overlays, camera presets,
statistics, and validation.

The capture command uses an installed Chromium browser to write:

```text
authoring/generated/captures/general-layout.png
authoring/generated/captures/iphone-12-area-a01.png
authoring/generated/captures/iphone-12-area-a02.png
authoring/generated/captures/iphone-12-area-a03.png
authoring/generated/debug/assembled-world-debug.glb
```

The assembled GLB contains stable prop names and `COLLIDER_*` helpers. It is for
inspection in Three.js Editor or other glTF tools and never ships as the runtime
world. If `A03_Corner_SW` needs a 90-degree rotation, change that named entry in its
typed layout and regenerate; edits made inside the debug GLB do not round-trip.

## Ownership

- `src/data/world/**`: authoritative dimensions, layouts, prop catalog and asset map.
- `src/domain/world/**`: pure transforms, collision values/math/compiler.
- `src/rendering/environment/**`: assets, materials, geometry, builder and providers.
- `authoring/local/**`: ignored raw/reference material; never rewritten by the builder.
- `authoring/generated/**`: ignored reproducible captures and debug output.
- `public/assets/world/**`: tracked curated runtime assets only.

See `three-editor.md` for the spatial and inspection contract and
`ASSET-LICENSES.md` for shipped provenance.
