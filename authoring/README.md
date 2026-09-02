# World authoring workspace

This directory separates **creative source material** from **runtime assets**.

## Local-only authoring files

Put the working Three.js Editor project and any source texture/model packs here:

```text
authoring/local/
├─ three-editor/
│  └─ infuse-world.json
└─ assets/
   ├─ textures/
   └─ models/
```

`authoring/local/` is intentionally ignored by Git. Three.js Editor JSON can become large because imported image/model data may be serialized into the project, and downloaded asset packs often contain many files that never ship in the game.

Keep your latest working Editor JSON backed up outside normal Git if it matters as creative source material. If long-term versioning of large authoring sources becomes necessary, use dedicated artifact storage or Git LFS rather than committing them to ordinary Git history.

## Generated local outputs

The planned authoring builder writes previews, reports, and intermediate files under:

```text
authoring/generated/
```

This directory is also ignored by Git. Everything in it must be reproducible from the authoring source plus the tracked builder code.

## Shipping assets

Only assets intentionally promoted to the game belong under:

```text
public/assets/world/
├─ areas/
├─ transitions/
└─ shared/
```

These files are tracked and shipped by the application. Prefer self-contained GLBs for area/transition chunks so unused source textures and model packs do not enter the production payload.

Do not copy an entire downloaded texture/model pack into `public/` just because one item was used while authoring. Promote only the exact runtime files required by the final scene.

Every third-party asset that reaches `public/` or is embedded in a shipping GLB must have its provenance/license recorded in `ASSET-LICENSES.md`.

## Source vs generated ownership

- `authoring/local/**`: user-owned creative workspace; the builder must never rewrite it.
- `authoring/generated/**`: builder-owned disposable output.
- `public/assets/world/**`: production output intentionally committed after visual QA.
- `scripts/world-authoring/**`: tracked deterministic build tooling.
- `tools/world-authoring-viewer/**`: tracked local viewer tooling.

See `three-editor.md` for the authoring conventions and `6-world-authoring-builder.md` for the implementation plan.
