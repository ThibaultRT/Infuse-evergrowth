# Area visual streaming — implemented contract

Area visual streaming is implemented by
`src/rendering/environment/WorldVisualStreamingManager.ts`. It remains a rendering-
only service: gameplay, collision, spawns, progression and gate state stay resident
and authoritative when a visual is absent, pending, failed or evicted.

The six production chunks are three areas and three connection-owned transitions.
All currently use `LayoutVisualProvider`, which builds the corresponding typed
`WorldLayout` with the shared `WorldBuilder`. `StreamedGlbVisualProvider` remains an
optional presentation adapter for a later measured optimization.

The residency policy is:

- keep the current area and all incident transition visuals mounted;
- prefetch the destination area near an incident gate;
- mount/unmount destination visuals using the hysteresis thresholds in
  `balance.json`;
- activate/deactivate enemy presentation separately from authoritative enemy state;
- re-check desired residency after every asynchronous load before mounting;
- keep cosmetic load failures playable through renderer fallbacks.

Transition content is never duplicated into neighboring areas. The typed transition
layout owns its bridge, river/wall seam, gate visual and explicit gameplay volumes.
Compiled collision exists before any provider starts loading and never streams.

Renderer statistics expose mounted areas/transitions, pending chunks, enemy
presentation counts, mixers, geometries, textures and render-buffer size. Verify
portrait crossings in both directions, delayed-load races, context loss and Full /
Reduced rendering modes whenever provider or asset weight changes.

See `2-environment.md` for the implemented environment migration and
`three-editor.md` for the spatial/debug contract.
