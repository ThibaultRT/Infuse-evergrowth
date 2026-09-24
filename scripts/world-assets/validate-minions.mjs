import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createServer } from 'vite';
globalThis.ProgressEvent ??= class ProgressEvent extends Event { constructor(type, values) { super(type); Object.assign(this, values); } };
const spec = JSON.parse(await readFile('src/data/world/minion-presentation.json', 'utf8'));

for (const [file, size, triangleLimit, bytesLimit] of [
  ['imp', spec.impHeight, 16000, 1500000], ['summoning-pit', spec.pit.diameter, 9000, 500000]
]) {
  const bytes = await readFile(`public/assets/world/shared/models/${file}.glb`);
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength));
  assert.ok(bytes.length < bytesLimit);
  const triangles = json.meshes.flatMap((mesh) => mesh.primitives).reduce((n, p) => n + json.accessors[p.indices].count / 3, 0);
  assert.ok(triangles <= triangleLimit);
  assert.ok(json.images.every((image) => image.bufferView !== undefined), 'Self-contained model');
  if (file === 'imp') { assert.equal(json.skins[0].joints.length, 55); assert.equal((json.animations ?? []).length, 0); }
  // Load geometry without DOM image decoding to check exported world-space fit.
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  delete json.materials; delete json.textures; delete json.images;
  json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(json), '');
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene, true);
  const dimensions = bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(bounds.min.y) < .01, `${file} must be grounded`);
  assert.ok(Math.abs((file === 'imp' ? dimensions.y : Math.max(dimensions.x, dimensions.z)) - size) < .02, `${file} normalized dimensions`);
  console.log(`${file}: ${triangles} triangles, ${bytes.length} bytes, bounds ${dimensions.toArray().map((v) => v.toFixed(3))}`);
}
const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
try {
  const [{ MINION_PIT }, { WorldNavigation }, { AREAS, WORLD_CONNECTIONS }] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/minionPit.ts'), vite.ssrLoadModule('/src/domain/world/WorldNavigation.ts'), vite.ssrLoadModule('/src/config.ts')
  ]);
  const navigation = new WorldNavigation(AREAS, WORLD_CONNECTIONS);
  // Deliberate clear, noncolliding landmark; geometry never creates collision.
  for (let n = 0; n < 16; n++) {
    const angle = n * Math.PI / 8;
    assert.ok(navigation.valid(1, { x: MINION_PIT.x + Math.cos(angle) * MINION_PIT.diameter / 2,
      z: MINION_PIT.z + Math.sin(angle) * MINION_PIT.diameter / 2 }, [1]), 'Pit perimeter must remain walkable');
  }
  assert.ok(navigation.valid(1, MINION_PIT, [1]));
} finally { await vite.close(); }
console.log('Minion asset fit, budgets, skeleton and authored pit clearance passed.');
