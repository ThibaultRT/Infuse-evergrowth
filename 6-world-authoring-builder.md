# World authoring builder — implemented contract

The former Editor-first/THREE.Terrain builder has been removed. The active generic
builder is `src/rendering/environment/WorldBuilder.ts`; it consumes renderer-neutral
typed layouts, semantic asset definitions and deterministic terrain profiles.

The same layout placement is consumed by `WorldCollisionCompiler`, so visual and
collision transforms cannot diverge. The browser preview imports the production
builder/compiler directly. `npm run authoring:world:build-debug` produces a one-way
assembled inspection GLB with named collision helpers.

See `authoring/README.md` for commands and ownership, and `three-editor.md` for the
fixed spatial/export contract.
