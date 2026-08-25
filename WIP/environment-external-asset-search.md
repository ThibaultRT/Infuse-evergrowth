# External Environment Asset Search — post Slice 12A

## Why this exists

Slice 12A confirmed that the current Quaternius runtime environment subset is far too small to build the approved world: it lacks proper houses, modular fortress walls/ruins, broad terrain pieces, large gates and enough structural variation. Do not keep asking Codex to synthesize final scenery from visible Three.js primitives.

The next environment step is therefore **asset-source selection outside Quaternius**, while keeping Three.js as the runtime renderer.

## Recommended source family: KayKit first

KayKit is the strongest first candidate because its packs share one stylized low-poly language, use atlas textures instead of flat single-color materials, are mobile-friendly, ship GLTF, and are CC0.

### 1. KayKit Medieval Builder Pack (Legacy) — FREE / CC0

Source: https://kaylousberg.itch.io/kaykit-medieval-builder-pack

Verified contents:
- 200+ stylized medieval scenery assets;
- 10+ buildings;
- defensive walls;
- road/connective tiles;
- water / river / coast tiles;
- scenery;
- hexagonal, square and free-placement variants;
- sand / rock / forest biome variants;
- FBX / OBJ / DAE / GLTF.

This is the first pack to test for Area 1/2 because it directly fills the missing houses, walls, roads, water and terrain categories.

### 2. KayKit Dungeon Pack 1.1 — FREE / CC0

Source: https://kaylousberg.itch.io/kaykit-dungeon-pack

Verified contents:
- 200 free stylized 3D dungeon assets;
- modular walls, floors, stairs, doors;
- barrels, crates, tables, banners and many props;
- GLTF / FBX / OBJ;
- one 1024x1024 gradient atlas;
- mobile-optimized.

This is the strongest immediate candidate for Area 3 ruined rooms/corridors. Intact dungeon modules can be composed as broken/open ruins rather than generating walls from boxes.

Optional Extra tier (~$7.95 at research time): 275+ total assets and 6 alternative textures.

### 3. KayKit Forest Nature Pack — FREE / CC0, Extra recommended if useful

Source: https://kaylousberg.itch.io/kaykit-forest

Verified free tier:
- 100+ trees, rocks, bushes and grass assets;
- GLTF / FBX / OBJ;
- mobile-friendly;
- one gradient atlas.

Extra tier (~$9.99 at research time) is particularly relevant because it adds **modular terrain**, additional trees/rocks and 8 color variations. This may be worth buying if the free terrain options from Medieval Builder are not enough for Area 1 west ridge / Area 2 darker biome.

### 4. KayKit Medieval Hexagon Pack — FREE / CC0

Source: https://kaylousberg.itch.io/kaykit-medieval-hexagon

Verified contents:
- 200+ models;
- roads, rivers, lakes/coasts;
- houses, tavern, church, market, barracks, blacksmith, mills, mine, well, etc.;
- trees, rocks, hills and mountains;
- GLTF / FBX / OBJ;
- one gradient atlas.

The hex terrain itself is probably not appropriate for Infuse, but the buildings/nature props may still be useful if they can be used in free-placement mode or separated from hex bases. Do not adopt hex terrain globally just because the pack contains many assets.

## Recommended secondary source family: Kenney

Kenney is also CC0 and its 3D assets are distributed as GLB/glTF, which Three.js can load directly.

Useful packs to inspect only after KayKit:

- Fantasy Town Kit — 160 files, medieval walls/town/buildings;
- Castle Kit — 75 files, castle/medieval structures;
- Tower Defense Kit — 160 files, medieval/castle pieces;
- Nature Kit — 330 files, trees/rocks/foliage;
- Modular Dungeon Kit — 40 modular dungeon files;
- Graveyard Kit — 90 files, darker props/vegetation.

Sources:
- https://kenney.nl/assets/fantasy-town-kit
- https://kenney.nl/assets/castle-kit
- https://kenney.nl/assets/tower-defense-kit
- https://kenney.nl/assets/nature-kit
- https://kenney.nl/assets/modular-dungeon-kit
- https://kenney.nl/assets/graveyard-kit

## Authoring tool direction

Do **not** build an Infuse-specific editor.

Crocotile 3D is now a viable authoring candidate because current versions can import FBX/GLTF/GLB/DAE/OBJ and export GLTF/GLB. It supports transforms, prefabs/instances, orthographic view and scene export. It is primarily tile-oriented, so test it with the chosen KayKit GLTF assets before committing the pipeline.

Source: https://www.crocotile3d.com/

If arbitrary imported KayKit assets are pleasant to place in Crocotile, prefer it over Blender for day-to-day map composition. If not, Blender remains the fallback authoring tool.

Three.js should only load the authored GLB/GLTF scene and keep gameplay/collision/progression authoritative.

## Immediate next experiment

Do NOT implement another whole-area pass.

1. Download / inspect only these three free packs first:
   - KayKit Medieval Builder Pack (Legacy)
   - KayKit Dungeon Pack 1.1
   - KayKit Forest Nature Pack
2. Render contact sheets from the actual models.
3. Compare their visual language at Infuse's camera angle against the existing hero/enemy Quaternius characters.
4. Select a minimal cross-pack subset for one Area 1 showcase screen:
   - 1–2 houses/landmarks;
   - 2–4 path/ground pieces;
   - 4–6 rocks/cliff elements;
   - 3–5 tree/bush variants;
   - 2–3 fence pieces;
   - one water/coast solution;
   - one gate/wall solution.
5. Build **one static showcase scene** in Crocotile or Blender and export GLB.
6. Load that GLB in Infuse without modifying gameplay.
7. Stop for iPhone screenshot review.

## Codex task boundary

Codex should not be asked to create terrain geometry or beauty-compose the whole map from code. Its role should be:
- audit/import external assets;
- produce contact sheets;
- prepare runtime-safe texture/model subset;
- wire GLB loading;
- preserve licenses/provenance;
- validate mobile payload/performance.

The actual environment composition should come from an external visual editor, using real textured models.