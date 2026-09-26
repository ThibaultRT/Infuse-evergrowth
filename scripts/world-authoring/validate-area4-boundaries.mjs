import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Deterministic boundary/asset checks; no live game or player-save access. */
export async function validateArea4Boundaries(vite) {
  const [boundary, { AREA_A04_LAYOUT: layout }, { RIFT_SOUTH_Z }, { compileWorldCollision }, { circleOverlapsWorldCollision: overlaps }, { WORLD_PROP_CATALOG: catalog }, { WORLD_ASSET_DEFINITIONS: assets }, { WorldBuilder }, { createWorldMaterials }, { GameplayRuntime }, config, { expandWorldScatter }, { AREA4_FOREST_SPEC }, { AREA4_GROVE_PLACEMENTS, AREA4_GROVE_VISUAL_RADIUS }] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/area4Boundaries.ts'), vite.ssrLoadModule('/src/data/world/areas/areaA04Layout.ts'),
    vite.ssrLoadModule('/src/data/world/area4.ts'), vite.ssrLoadModule('/src/domain/world/WorldCollisionCompiler.ts'),
    vite.ssrLoadModule('/src/domain/world/CollisionMath.ts'), vite.ssrLoadModule('/src/data/world/WorldPropCatalog.ts'),
    vite.ssrLoadModule('/src/data/world/WorldAssetKeys.ts'), vite.ssrLoadModule('/src/rendering/environment/WorldBuilder.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldMaterials.ts'), vite.ssrLoadModule('/src/game/GameplayRuntime.ts'),
    vite.ssrLoadModule('/src/config.ts'), vite.ssrLoadModule('/src/data/world/WorldLayout.ts'),
    vite.ssrLoadModule('/src/data/world/area4Forest.ts'), vite.ssrLoadModule('/src/data/world/area4Groves.ts'),
  ]);
  const { AREA4_BOUNDARY_SPEC: spec, AREA4_BOUNDARY_PLACEMENTS: placements, AREA4_SOUTH_GROUND_Z, AREA4_EAST_GATE_PLACEMENT: gate } = boundary;
  const compiled = compileWorldCollision([layout]).all;
  const shapes = compiled.filter((shape) => placements.some((p) => p.name === shape.sourcePlacementName));
  const lake = shapes.find((shape) => shape.sourcePlacementName === 'A04_South_Lava_Transition');
  const shoreZ = lake.z - lake.depth / 2;
  const eastX = layout.origin[0] + layout.playableSize.width / 2;
  const southZ = layout.origin[2] + layout.playableSize.depth / 2;
  assert.equal(shapes.length, placements.length, 'Each boundary placement owns exactly one semantic footprint.');
  assert.ok(shapes.every((s) => !s.activation), 'The outer boundary must remain closed after any boss unlock.');
  assert.ok(Math.abs((gate.position[2] + layout.origin[2] - RIFT_SOUTH_Z) / (southZ - RIFT_SOUTH_Z) - .7) < 1e-8);
  assert.equal(shoreZ, layout.origin[2] + AREA4_SOUTH_GROUND_Z);
  assert.ok(shoreZ < southZ && lake.width >= layout.playableSize.width, 'Lava must start inside and cover the whole south edge.');
  for (let z = RIFT_SOUTH_Z; z <= southZ; z += .1) {
    assert.ok(shapes.some((s) => overlaps({ x: eastX, z }, .05, s)), `Eastern wall has a gap at Z=${z}.`);
  }
  for (let x = lake.x - lake.width / 2; x <= lake.x + lake.width / 2; x += .25) for (const z of [shoreZ, southZ, lake.z + lake.depth / 2]) {
    assert.ok(overlaps({ x, z }, .05, lake), `Lava leaves an escape at ${x},${z}.`);
  }
  const radiusByKey = { 'nature.charredTrunkA': 'trunkA', 'nature.charredTrunkB': 'trunkB', 'nature.charredStump': 'stump', 'nature.charredLog': 'log', 'nature.basaltA': 'basaltA', 'nature.basaltB': 'basaltB' };
  for (const p of [...layout.scatters.flatMap(expandWorldScatter), ...AREA4_GROVE_PLACEMENTS]) {
    const radius = (AREA4_FOREST_SPEC.props[radiusByKey[p.prop]]?.visualRadius ?? AREA4_GROVE_VISUAL_RADIUS) * (p.scale ?? 1);
    assert.ok(p.position[2] + radius < AREA4_SOUTH_GROUND_Z, `${p.name} floats above the southern lava.`);
    assert.ok(!shapes.some((s) => overlaps({ x: p.position[0] + layout.origin[0], z: p.position[2] + layout.origin[2] }, radius, s)), `${p.name} crowds a boundary.`);
  }
  // Exercise the actual movement solver against the compiled boundaries in isolation;
  // trees or the world's outer clamp must not mask a missing lava/fence collider.
  const create = () => new GameplayRuntime({
    areas: config.AREAS.map((area) => area.id === 4 ? { ...area, collision: shapes } : area),
    connections: config.WORLD_CONNECTIONS, unlockedAreas: [1, 2, 3, 4], spawns: [], currentAreaId: 4,
    heroHp: 100, heroSpeed: config.HERO_SPEED, heroRespawnSeconds: 1, enemyAggroRadius: 10,
    enemyLeashRadius: 15, enemyAttackRange: 2, enemyPositioningRange: 2, enemyAttackCooldown: 1,
  });
  for (const fps of [30, 60]) {
    for (let x = -35.4; x <= 107.4; x += 2.1) {
      const runtime = create();
      runtime.hero.position = { x, y: 0, z: shoreZ - 2 };
      for (let frame = 0; frame < fps * 2; frame++) runtime.update(1 / fps, { x: 0, y: -1 }, true);
      assert.ok(runtime.hero.position.z <= shoreZ - .45 + 1e-6, `Southern lava leaked at ${x}, ${fps} FPS.`);
    }
    for (const p of placements.filter((p) => p.prop.startsWith('boundary.'))) {
      const runtime = create(), depth = catalog[p.prop].collision[0].depth;
      runtime.hero.position = { x: eastX - 2, y: 0, z: p.position[2] + layout.origin[2] };
      for (let frame = 0; frame < fps * 2; frame++) runtime.update(1 / fps, { x: 1, y: 0 }, true);
      assert.ok(runtime.hero.position.x <= eastX - depth / 2 - .45 + 1e-6, `${p.name} leaked at ${fps} FPS.`);
    }
    for (const side of [-1, 1]) {
      const runtime = create();
      runtime.hero.position = { x: layout.origin[0] + side * (layout.playableSize.width / 2 - 2), y: 0, z: shoreZ - 2 };
      for (let frame = 0; frame < fps * 3; frame++) runtime.update(1 / fps, { x: side, y: -1 }, true);
      assert.ok(runtime.hero.position.z <= shoreZ - .45 + 1e-6, 'Diagonal movement escaped a southern corner.');
    }
  }
  let payload = 0, placedTriangles = 0;
  const loader = new GLTFLoader().register(() => ({ name: 'BoundaryValidationTextureIO', loadTexture: async () => new THREE.Texture() }));
  for (const name of ['fence', 'gate']) {
    const key = `boundary.area4${name[0].toUpperCase() + name.slice(1)}`;
    const bytes = await readFile(`public/${assets[key].runtime}`); payload += bytes.length;
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    assert.ok(json.buffers.every((b) => !b.uri) && json.images.every((i) => !i.uri));
    assert.ok(!json.extensionsRequired?.length, 'Boundary models must not add decoder dependencies.');
    assert.equal(json.materials.length, 1); assert.equal(json.images.length, 3);
    const primitives = json.meshes.flatMap((mesh) => mesh.primitives);
    assert.equal(primitives.length, 1);
    const triangles = json.accessors[primitives[0].indices].count / 3;
    assert.ok(triangles <= spec[name].triangleBudget);
    placedTriangles += triangles * placements.filter((p) => p.prop === key).length;
    const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const bounds = new THREE.Box3().setFromObject(scene), size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(bounds.min.y) < 1e-5 && Math.abs(size.x - spec[name].width) < 1e-4, `${key}: pivot/width mismatch.`);
    assert.ok(size.y <= spec[name].height + 1e-4 && size.z <= spec[name].depth + 1e-4, `${key}: exceeds semantic footprint.`);
    assert.ok(Math.abs(bounds.min.x + bounds.max.x) < 1e-4 && Math.abs(bounds.min.z + bounds.max.z) < 1e-4);
    scene.traverse((mesh) => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } });
  }
  assert.ok(payload < 2.5 * 1048576 && placedTriangles <= 30000, 'Boundary assets exceed their runtime budget.');
  const missing = {
    retain: () => () => {}, preload: async () => {}, loadTexture: async () => new THREE.Texture(),
    instantiate: async (key) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); mesh.userData.worldAssetFallback = key; return mesh; },
  };
  const materials = await createWorldMaterials(missing);
  const view = await new WorldBuilder(missing, materials).build({ ...layout, props: placements, scatters: [] });
  for (const p of placements.filter((p) => p.prop.startsWith('boundary.'))) {
    const object = view.root.getObjectByName(p.name);
    assert.ok(object?.children.length && object.userData.worldAssetFallback && object.userData.cameraOccluder, `${p.name} needs a visible occluding fallback.`);
  }
  const ground = view.root.getObjectByName('A04_AshAndCharcoalGround').geometry.attributes.position;
  for (let i = 0; i < ground.count; i++) assert.ok(ground.getZ(i) <= AREA4_SOUTH_GROUND_Z, 'Ash ground covers the lake.');
  view.root.updateMatrixWorld(true);
  let lakeTriangles = 0;
  view.root.getObjectByName('A04_South_Lava_Transition').traverse((mesh) => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position;
    lakeTriangles += positions.count / 3;
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      assert.ok(overlaps(p, .0001, lake), 'Lava/crust projects onto walkable ground.');
    }
  });
  assert.ok(lakeTriangles < 4000, 'Lake geometry exceeds its 4k budget.');
  view.dispose();
  const shared = new Set([...Object.values(materials.terrain), ...Object.values(materials.area4), ...Object.values(materials.blockout), ...Object.values(materials).filter((value) => value?.isMaterial)]);
  for (const material of shared) { material.map?.dispose(); material.normalMap?.dispose(); material.dispose(); }
  console.log(`Area 4 boundaries: continuous eastern wall, closed 70% gate, full-width lava and corner containment at 30/60 FPS; ${placedTriangles} model + ${lakeTriangles} lake triangles, ${(payload / 1048576).toFixed(2)} MiB; fallbacks passed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  try { await validateArea4Boundaries(vite); } finally { await vite.close(); }
}
