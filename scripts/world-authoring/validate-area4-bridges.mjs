import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Focused S2/W2 integration check; the full world/device review is separate. */
export async function validateArea4Bridges(vite, config) {
  const [{ GameplayRuntime }, { WORLD_LAYOUTS }, { WORLD_PROP_CATALOG }, { WorldChunkView }, { worldWalkHeight }] = await Promise.all([
    vite.ssrLoadModule('/src/game/GameplayRuntime.ts'),
    vite.ssrLoadModule('/src/data/world/index.ts'),
    vite.ssrLoadModule('/src/data/world/WorldPropCatalog.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldBuilder.ts'),
    vite.ssrLoadModule('/src/domain/world/WorldWalkSurface.ts'),
  ]);
  const loader = new GLTFLoader();
  const root = 'public/assets/world/shared/models/';
  const assetBytes = async (file) => {
    const bytes = await readFile(root + file);
    assert.ok(bytes.length < 3 * 1048576, `${file} exceeds 3 MiB.`);
    const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    assert.ok(!(json.buffers ?? []).some((b) => b.uri) && !(json.images ?? []).some((i) => i.uri), `${file} is not self-contained.`);
    assert.ok(json.materials.length <= 3);
    const count = json.meshes.flatMap((m) => m.primitives).reduce((sum, p) => sum + json.accessors[p.indices].count / 3, 0);
    assert.ok(count <= 30000, `${file} exceeds 30k triangles.`);
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  };
  const crossings = [
    { id: 'area1-area4', bridge: 'area4-s2-rib-vault.glb', gate: 'area4-s2-land-gate.glb', plane: 27 },
    { id: 'area3-area4', bridge: 'area4-w2-timber-bridge.glb', gate: 'area4-w2-wall-gate.glb', plane: 29.3 },
  ];
  for (const entry of crossings) {
    const connection = config.WORLD_CONNECTIONS.find((c) => c.id === entry.id);
    const area = config.AREAS.find((a) => a.id === connection.areaAId);
    const layout = WORLD_LAYOUTS.find((l) => l.connectionId === entry.id);
    const locks = area.collision.filter((c) => c.activation?.connectionId === entry.id);
    assert.equal(locks.length, 1, 'One physical gate owns each crossing lock.');
    assert.ok(Math.abs(locks[0].z - entry.plane) < 1e-8, 'The barrier must coincide with its gate leaves.');
    const placement = layout.props.find((p) => p.name === locks[0].sourcePlacementName);
    const definition = WORLD_PROP_CATALOG[placement.prop];
    const gltf = await assetBytes(entry.gate);
    const view = new WorldChunkView(layout);
    view.root.position.set(0, 0, 0);
    view.root.add(gltf.scene);
    for (const leaf of definition.gate.leaves) {
      const node = gltf.scene.getObjectByName(leaf.node);
      assert.ok(node, `Missing animated hinge ${leaf.node}.`);
      view.addGateLeaf(node, leaf.openAngle);
    }
    view.setOpen(true);
    view.root.updateMatrixWorld(true);
    for (const leaf of definition.gate.leaves) {
      const box = new THREE.Box3().setFromObject(gltf.scene.getObjectByName(leaf.node));
      assert.ok(leaf.node.endsWith('Left') ? box.max.x <= -1.7 : box.min.x >= 1.7, `${leaf.node} narrows the open 3.4 m route.`);
    }
    view.setOpen(false);
    for (const leaf of definition.gate.leaves) assert.ok(gltf.scene.getObjectByName(leaf.node).quaternion.angleTo(new THREE.Quaternion()) < 1e-6, 'Gate must return to its authored closed pose.');

    const bridge = (await assetBytes(entry.bridge)).scene;
    bridge.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const z of [-8.5, -6, -3, 0, 3, 6, 8.5]) for (const x of [-1.1, 0, 1.1]) {
      ray.set(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(bridge, true)[0];
      const expected = worldWalkHeight(area.walkSurfaces, { x: connection.x + x, z: 36 + z });
      assert.ok(hit && Math.abs(hit.point.y - expected) < .021, `${entry.bridge}: deck disagrees with authored floor at ${x},${z}.`);
    }
    for (const offset of [0, 1.1]) {
      const unlocked = [1, 2, 3];
      const runtime = new GameplayRuntime({ areas: config.AREAS, connections: config.WORLD_CONNECTIONS, unlockedAreas: unlocked,
        spawns: [], currentAreaId: connection.areaAId, heroHp: 100, heroSpeed: config.HERO_SPEED, heroRespawnSeconds: 1,
        enemyAggroRadius: 10, enemyLeashRadius: 15, enemyAttackRange: 2, enemyPositioningRange: 2, enemyAttackCooldown: 1 });
      runtime.hero.position = { x: connection.x + offset, y: 0, z: 25 };
      for (let i = 0; i < 240; i++) runtime.update(1 / 60, { x: 0, y: -1 }, true);
      assert.ok(runtime.hero.position.z < entry.plane && runtime.currentAreaId === connection.areaAId, 'Closed gate must block on the land side.');
      unlocked.push(4);
      for (let i = 0; i < 240; i++) runtime.update(1 / 60, { x: 0, y: -1 }, true);
      assert.ok(runtime.currentAreaId === 4 && runtime.hero.position.z > 45, 'Open gate must allow the complete bridge crossing.');
    }
  }
  console.log('S2/W2: packed assets, hinge clearance, authored deck fit and locked/unlocked traversal passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  try { await validateArea4Bridges(vite, await vite.ssrLoadModule('/src/config.ts')); }
  finally { await vite.close(); }
}
