import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

async function validateBridgeAsset() {
  const bytes = await readFile('public/assets/world/shared/models/woodland-bridge.glb');
  const jsonLength = bytes.readUInt32LE(12);
  const document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  const binaryStart = 20 + jsonLength + 8;
  // Geometry-only inspection needs no browser image decoder. This is validation,
  // never a source of runtime collision or elevation.
  delete document.images;
  delete document.textures;
  document.materials = [{}];
  let triangles = 0;
  for (const mesh of document.meshes) for (const primitive of mesh.primitives) {
    primitive.material = 0;
    triangles += document.accessors[primitive.indices].count / 3;
  }
  assert.ok(triangles < 140000, `Woodland bridge exceeds its 140k triangle budget (${triangles}).`);
  assert.ok(bytes.length < 10 * 1024 * 1024, 'Woodland bridge exceeds its 10 MiB payload budget.');
  const json = Buffer.from(JSON.stringify(document));
  const paddedJson = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
  const binaryChunk = bytes.subarray(binaryStart - 8);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + paddedJson.length + binaryChunk.length, 8);
  header.writeUInt32LE(paddedJson.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const geometryGlb = Buffer.concat([header, paddedJson, binaryChunk]);
  const { scene } = await new GLTFLoader().parseAsync(geometryGlb.buffer.slice(geometryGlb.byteOffset, geometryGlb.byteOffset + geometryGlb.byteLength), '');
  scene.updateMatrixWorld(true);
  for (const side of ['Left', 'Right']) assert.ok(scene.getObjectByName(`WoodlandBridge_Gate${side}`), 'Both side hinges must survive export.');
  assert.ok(scene.getObjectByName('WoodlandBridge_Canopy')?.userData.cameraOccluder, 'Canopy must retain its occlusion tag.');
  const spec = JSON.parse(await readFile('src/data/world/woodland-bridge.json', 'utf8'));
  const scale = spec.deckLength / (spec.sourceDeckMax - spec.sourceDeckMin);
  const center = (spec.sourceDeckMin + spec.sourceDeckMax) / 2;
  const body = scene.getObjectByName('WoodlandBridge_Body');
  for (let plank = 0; plank < 28; plank++) for (const x of [-1.1, 0, 1.1]) {
    const z = -(-4.22 + plank * 0.333 - center) * scale;
    const ray = new THREE.Raycaster(new THREE.Vector3(x, spec.deckHeight + 0.2, z), new THREE.Vector3(0, -1, 0), 0, 0.4);
    const hit = ray.intersectObject(body, true)[0];
    assert.ok(hit && Math.abs(hit.point.y - spec.deckHeight) < 0.04, `Walkable floor must agree with the visible plank at ${x}, ${z}.`);
  }
  scene.traverse((object) => { if (object.isMesh) object.geometry.dispose(); });
}

/** Deterministic traversal checks run by the existing world validation command. */
export async function validateCrossings(vite, config) {
  await validateBridgeAsset();
  const [{ GameplayRuntime }, { worldWalkHeight }, { compileWorldWalkSurfaces }, { WORLD_LAYOUTS }, { transformWorldPoint }] = await Promise.all([
    vite.ssrLoadModule('/src/game/GameplayRuntime.ts'),
    vite.ssrLoadModule('/src/domain/world/WorldWalkSurface.ts'),
    vite.ssrLoadModule('/src/domain/world/WorldWalkSurfaceCompiler.ts'),
    vite.ssrLoadModule('/src/data/world/index.ts'),
    vite.ssrLoadModule('/src/domain/world/WorldPlacement.ts'),
  ]);
  const create = (areaId, unlockedAreas = config.AREAS.map((area) => area.id)) => new GameplayRuntime({
    areas: config.AREAS, connections: config.WORLD_CONNECTIONS, unlockedAreas,
    spawns: [], currentAreaId: areaId, heroHp: 100, heroSpeed: config.HERO_SPEED,
    heroRespawnSeconds: 1, enemyAggroRadius: 10, enemyLeashRadius: 15,
    enemyAttackRange: 2, enemyPositioningRange: 2, enemyAttackCooldown: 1,
  });
  for (const fps of [30, 60]) for (const connection of config.WORLD_CONNECTIONS) for (const reverse of [false, true]) {
    const sourceId = reverse ? connection.areaBId : connection.areaAId;
    const targetId = reverse ? connection.areaAId : connection.areaBId;
    const source = config.AREAS.find((area) => area.id === sourceId);
    const target = config.AREAS.find((area) => area.id === targetId);
    const direction = Math.sign(connection.axis === 'x' ? target.originX - source.originX : target.originZ - source.originZ);
    const runtime = create(sourceId);
    runtime.hero.position = { x: connection.x, y: 0, z: connection.z };
    const reach = connection.areaBId === 4 ? 17 : 11;
    runtime.hero.position[connection.axis] -= direction * reach;
    const input = connection.axis === 'x' ? { x: direction, y: 0 } : { x: 0, y: -direction };
    const events = [];
    let maximumHeight = 0;
    for (let frame = 0; frame < Math.ceil(reach * 2 / config.HERO_SPEED * fps); frame++) {
      const before = { ...runtime.hero.position };
      events.push(...runtime.update(1 / fps, input, true));
      const position = runtime.hero.position;
      const area = config.AREAS.find((candidate) => candidate.id === runtime.currentAreaId);
      assert.equal(position.y, worldWalkHeight(area.walkSurfaces, position), 'Actor must follow the shared floor through area entry.');
      assert.ok(Math.hypot(position.x - before.x, position.z - before.z) <= config.HERO_SPEED / fps + 1e-6, 'Crossing must not teleport the actor.');
      assert.ok(Math.abs(position.y - before.y) < 0.16, 'Landing must not snap vertically.');
      maximumHeight = Math.max(maximumHeight, position.y);
    }
    assert.equal(runtime.currentAreaId, targetId, `${connection.id} must cross in both directions at ${fps} FPS.`);
    assert.equal(events.filter((event) => event.type === 'areaEntered').length, 1, 'An area seam must emit only one entry per crossing.');
    assert.equal(runtime.hero.position.y, 0, 'The actor must return to land height.');
    if (connection.id === 'area1-area2') assert.equal(maximumHeight, 1.65, 'The woodland deck must elevate the actor.');
  }

  const connection = config.WORLD_CONNECTIONS.find((item) => item.id === 'area1-area2');
  for (const offset of [-1.05, 0.15, 1.05]) for (const reverse of [false, true]) {
    const crossing = create(reverse ? 2 : 1);
    crossing.hero.position = { x: connection.x + offset, y: 0, z: connection.z + (reverse ? -10 : 10) };
    const events = [];
    for (let frame = 0; frame < 170; frame++) events.push(...crossing.update(1 / 60, { x: 0, y: reverse ? -1 : 1 }, true));
    assert.equal(crossing.currentAreaId, reverse ? 1 : 2, 'Off-center actors must cross the whole bridge.');
    assert.ok(Math.abs(crossing.hero.position.z - connection.z) > 9, `Bridge landing is obstructed at lateral offset ${offset}.`);
    assert.equal(events.filter((event) => event.type === 'areaEntered').length, 1);
    assert.equal(crossing.hero.position.y, 0);
  }
  const unlocked = [1];
  const runtime = create(1, unlocked);
  runtime.hero.position = { x: connection.x, y: 0, z: connection.z + 11 };
  for (let frame = 0; frame < 180; frame++) runtime.update(1 / 60, { x: 0, y: 1 }, true);
  assert.equal(runtime.currentAreaId, 1, 'Closed bridge must retain the boss progression lock.');
  const barrier = config.AREAS[0].collision.find((shape) => shape.activation?.connectionId === connection.id);
  assert.ok(runtime.hero.position.z >= barrier.z + barrier.depth / 2 + 0.45 - 1e-6, 'Hero must stop in front of the visible closed doors.');
  unlocked.push(2);
  for (let frame = 0; frame < 160; frame++) runtime.update(1 / 60, { x: 0, y: 1 }, true);
  assert.equal(runtime.currentAreaId, 2, 'Unlocking the gate must allow crossing without reloading.');
  for (const side of [-1, 1]) {
    runtime.currentAreaId = 1;
    runtime.hero.position = { x: connection.x, y: 1.65, z: connection.z + 2 };
    for (let frame = 0; frame < 100; frame++) runtime.update(1 / 60, { x: side, y: 0 }, true);
    assert.ok(Math.abs(runtime.hero.position.x - connection.x) <= connection.width / 2 - 0.45 + 1e-6, 'Bridge edges must prevent stepping into the river.');
    assert.equal(runtime.hero.position.y, 1.65);
  }

  const transition = WORLD_LAYOUTS.find((layout) => layout.id === 'transition:A01-A02');
  const moved = { ...transition, origin: [31, 2, -73], props: transition.props.map((prop) => ({ ...prop, position: [4, 1, -2], rotation: Math.PI / 2, scale: 2 })) };
  const compiled = compileWorldWalkSurfaces([moved]);
  const surface = compiled[1][0];
  const [x, z] = transformWorldPoint([0, 7.5], surface.transform);
  assert.ok(Math.abs(worldWalkHeight(compiled[1], { x, z }) - 4.65) < 1e-6, 'Elevation must follow the same translated, rotated and scaled prop placement.');
}
