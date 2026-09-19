import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import jpeg from 'jpeg-js';

/** Asset and clearance checks only; no browser, save writes or live gameplay. */
export async function validateArea4Forest(vite) {
  const [{ AREA_A04_LAYOUT: layout }, { AREA4_FOREST_SPEC: spec }, { AREA4_SPEC }, { expandWorldScatter }, { WORLD_PROP_CATALOG: catalog }, { WORLD_ASSET_DEFINITIONS: assets }, { sampleWorldRoad }, { compileWorldCollision }, { WorldBuilder }, { createWorldMaterials }, { AREA4_GROVE_PLACEMENTS: groves, AREA4_GROVE_VISUAL_RADIUS: groveRadius, createArea4GroveTrees }, { transformWorldPoint }, { circleOverlapsWorldCollision }] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/areas/areaA04Layout.ts'), vite.ssrLoadModule('/src/data/world/area4Forest.ts'),
    vite.ssrLoadModule('/src/data/world/area4.ts'), vite.ssrLoadModule('/src/data/world/WorldLayout.ts'),
    vite.ssrLoadModule('/src/data/world/WorldPropCatalog.ts'), vite.ssrLoadModule('/src/data/world/WorldAssetKeys.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldGeometry.ts'), vite.ssrLoadModule('/src/domain/world/WorldCollisionCompiler.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldBuilder.ts'), vite.ssrLoadModule('/src/rendering/environment/WorldMaterials.ts'),
    vite.ssrLoadModule('/src/data/world/area4Groves.ts'), vite.ssrLoadModule('/src/domain/world/WorldPlacement.ts'), vite.ssrLoadModule('/src/domain/world/CollisionMath.ts'),
  ]);
  const dimensions = Object.fromEntries(Object.entries(spec.props).map(([key, value]) => [`nature.${key.startsWith('basalt') ? key : 'charred' + key[0].toUpperCase() + key.slice(1)}`, value]));
  const placements = layout.scatters.flatMap(expandWorldScatter);
  assert.deepEqual(placements, layout.scatters.flatMap(expandWorldScatter), 'Forest placements must be deterministic.');
  assert.ok(placements.length >= 85 && placements.length <= 100, 'Keep the forest populated but within its 100-prop draw budget; exhausted candidates may be skipped.');
  assert.ok(!layout.props.some((p) => p.prop.startsWith('blockout.')), 'Old tree markers remain.');
  const envelopes = [...placements, ...groves];
  const radius = (p) => (dimensions[p.prop]?.visualRadius ?? groveRadius) * (p.scale ?? 1);
  for (const [i, p] of envelopes.entries()) {
    const [x, , z] = p.position, r = radius(p);
    assert.ok(x - r > -72 && x + r < 72 && z - r > -18 && z + r < 24, `${p.name} crosses the playable edge or rift.`);
    for (const spot of [...layout.encounterSpots, ...AREA4_SPEC.lavaPools]) {
      assert.ok(Math.hypot(x - spot.center[0], z - spot.center[1]) >= r + spot.radius + .5, `${p.name} crowds ${spot.id}.`);
    }
    const throne = AREA4_SPEC.throne;
    assert.ok(Math.hypot(x - throne.center[0], z - throne.center[1]) >= r + Math.hypot(throne.width, throne.depth) / 2 + 1.5, `${p.name} crowds the throne.`);
    for (const road of layout.roads) {
      const points = sampleWorldRoad(road);
      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1], b = points[j], dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
        assert.ok(Math.hypot(x - a.x - t * dx, z - a.z - t * dz) >= r + road.width / 2 + .3, `${p.name} intrudes on the rendered ${road.name} curve.`);
      }
    }
    for (const other of envelopes.slice(0, i)) assert.ok(Math.hypot(x - other.position[0], z - other.position[2]) >= r + radius(other) + .4, `${p.name} overlaps ${other.name}.`);
  }
  const compiled = compileWorldCollision([layout]).all;
  for (const p of envelopes) {
    const shapes = compiled.filter((shape) => shape.sourcePlacementName === p.name);
    assert.equal(shapes.length, 1, `${p.name} must retain one semantic footprint.`);
    assert.equal(shapes[0].x, layout.origin[0] + p.position[0]);
    assert.equal(shapes[0].z, layout.origin[2] + p.position[2]);
  }
  assert.equal(groves.length, 2);
  const groveTrees = groves.flatMap((grove) => catalog[grove.prop].visualChildren);
  for (const grove of groves) {
    const children = catalog[grove.prop].visualChildren;
    assert.equal(children.length, 20, 'Each dense grove should contain twenty trees.');
    assert.equal(new Set(children.map((child) => child.rotation)).size, 20, 'Grove trees need varied orientations.');
    assert.deepEqual(children, createArea4GroveTrees(grove.name === spec.groves.west.name ? spec.groves.west.seed : spec.groves.east.seed));
    for (const child of children) {
      assert.equal(child.collision, 'none', 'Grove trees must not add individual colliders.');
      assert.ok(Math.hypot(child.position[0], child.position[2]) + dimensions[child.prop].radius * child.scale <= spec.groves.radius, 'A grove trunk extends outside the blocked disk.');
    }
    const shape = compiled.find((candidate) => candidate.sourcePlacementName === grove.name);
    assert.equal(shape.kind, 'circle'); assert.equal(shape.radius, spec.groves.radius);
    assert.ok(!compiled.some((candidate) => candidate.sourcePlacementName?.startsWith(`${grove.name}/`)), 'A grove has child collision.');
    // The complete disk is blocked, including the visible gaps between trunks.
    for (let step = 0; step < 32; step++) {
      const angle = step / 32 * Math.PI * 2;
      for (const r of [0, 2, 4, shape.radius - .1]) assert.ok(circleOverlapsWorldCollision({ x: shape.x + Math.cos(angle) * r, z: shape.z + Math.sin(angle) * r }, .45, shape));
      const outside = { x: shape.x + Math.cos(angle) * (shape.radius + .6), z: shape.z + Math.sin(angle) * (shape.radius + .6) };
      assert.ok(!compiled.some((obstacle) => circleOverlapsWorldCollision(outside, .45, obstacle)), 'The player cannot skirt a grove perimeter.');
    }
  }
  // Decode geometry with the production glTF loader while replacing only DOM texture IO.
  const loader = new GLTFLoader().register(() => ({ name: 'ForestValidationTextureIO', loadTexture: async () => new THREE.Texture() }));
  const triangles = new Map();
  let payload = 0;
  for (const [key, shape] of Object.entries(dimensions)) {
    const bytes = await readFile(`public/${assets[key].runtime}`);
    payload += bytes.length;
    const jsonLength = bytes.readUInt32LE(12), json = JSON.parse(bytes.subarray(20, 20 + jsonLength));
    const binary = bytes.subarray(28 + jsonLength);
    assert.ok(json.buffers.every((b) => !b.uri) && json.images.every((image) => !image.uri), `${key} has external dependencies.`);
    assert.equal(json.materials.length, 1);
    const primitives = json.meshes.flatMap((mesh) => mesh.primitives);
    assert.equal(primitives.length, 1, `${key} should be a single draw.`);
    triangles.set(key, json.accessors[primitives[0].indices].count / 3);
    assert.ok(triangles.get(key) <= 800, `${key} exceeds its mesh budget.`);
    assert.equal(json.images.length, 2);
    for (const image of json.images) {
      const view = json.bufferViews[image.bufferView];
      const decoded = jpeg.decode(binary.subarray(view.byteOffset, view.byteOffset + view.byteLength), { useTArray: true });
      assert.equal(decoded.width, 512); assert.equal(decoded.height, 512);
    }
    const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(scene);
    assert.ok(Math.abs(bounds.min.y) < 1e-4 && Math.abs(bounds.max.y - shape.height) < 1e-4, `${key} has incorrect height or pivot.`);
    scene.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        assert.ok(Math.hypot(p.x, p.z) <= shape.visualRadius + 1e-4, `${key} exceeds its reserved visual radius.`);
        if (key.includes('Trunk') && p.y > 1.3) continue;
        assert.ok(shape.width ? Math.abs(p.x) <= shape.width / 2 + 1e-4 && Math.abs(p.z) <= shape.depth / 2 + 1e-4 : Math.hypot(p.x, p.z) <= shape.radius + 1e-4, `${key} projects outside its ground footprint.`);
      }
      mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.normalMap?.dispose(); mesh.material.dispose();
    });
  }
  assert.ok(payload < 1.2 * 1048576, 'Forest assets exceed 1.2 MiB.');
  const placedTriangles = [...placements, ...groveTrees].reduce((sum, p) => sum + triangles.get(p.prop), 0);
  assert.ok(placedTriangles < 80000 && placements.length + groveTrees.length <= 140, 'Forest population exceeds 80k triangles or 140 prop draws.');
  const prefetched = new Set();
  const missing = {
    preload: async (keys) => keys.forEach((key) => prefetched.add(key)), loadTexture: async () => new THREE.Texture(),
    instantiate: async (key) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); mesh.userData.worldAssetFallback = key; return mesh; },
  };
  const materials = await createWorldMaterials(missing);
  const builder = new WorldBuilder(missing, materials);
  await builder.prefetch({ ...layout, props: groves, scatters: [] });
  assert.deepEqual([...prefetched].sort(), ['nature.charredTrunkA', 'nature.charredTrunkB'], 'Composite-only layouts must prefetch child assets.');
  const view = await builder.build(layout);
  view.root.updateMatrixWorld(true);
  for (const p of placements) {
    const object = view.root.getObjectByName(p.name);
    assert.ok(object?.children.length && object.userData.worldAssetFallback === catalog[p.prop].asset, `${p.name} lacks its visible fallback.`);
    assert.equal(object.userData.cameraOccluder, p.prop.includes('Trunk'));
  }
  for (const grove of groves) {
    const group = view.root.getObjectByName(grove.name);
    assert.equal(group.children.length, 20, 'The grove must remain visibly dense when model loading fails.');
    const shape = compiled.find((candidate) => candidate.sourcePlacementName === grove.name);
    for (const child of catalog[grove.prop].visualChildren) {
      const object = group.getObjectByName(`${grove.name}/${child.name}`);
      assert.ok(object?.userData.worldAssetFallback && object.userData.cameraOccluder);
      const expected = transformWorldPoint([child.position[0], child.position[2]], { position: [shape.x, 0, shape.z], rotation: grove.rotation });
      const actual = object.getWorldPosition(new THREE.Vector3());
      assert.ok(Math.hypot(actual.x - expected[0], actual.z - expected[1]) < 1e-5, 'Grove children must follow their single authored parent transform.');
    }
  }
  view.dispose();
  const shared = new Set([...Object.values(materials.terrain), ...Object.values(materials.area4), ...Object.values(materials.blockout), ...Object.values(materials).filter((value) => value?.isMaterial)]);
  for (const material of shared) { material.map?.dispose(); material.normalMap?.dispose(); material.dispose(); }
  console.log(`Area 4 forest: ${placements.length} loose props + ${groves.length} groves of 20 trees, ${placedTriangles} triangles, ${(payload / 1048576).toFixed(2)} MiB; paths, circular barriers, parent transforms and loading fallbacks passed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const vite = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
  try { await validateArea4Forest(vite); } finally { await vite.close(); }
}
