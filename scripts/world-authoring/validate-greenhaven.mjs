import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Verify the authored cove doesn't strand a spawn or cut off a village exit. */
export async function validateGreenhaven(vite, config) {
  const [{ AREA_A01_LAYOUT: layout }, { circleOverlapsWorldCollision }, { greenhavenGroundHeight }, { expandWorldScatter }] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/areas/areaA01Layout.ts'),
    vite.ssrLoadModule('/src/domain/world/CollisionMath.ts'),
    vite.ssrLoadModule('/src/data/world/greenhaven.ts'),
    vite.ssrLoadModule('/src/data/world/WorldLayout.ts'),
  ]);
  const area = config.AREAS.find((candidate) => candidate.id === 1);
  const step = 0.5;
  const half = area.size.width / 2 - 1;
  const columns = half * 2 / step + 1;
  const point = (index) => ({ x: index % columns * step - half, z: Math.floor(index / columns) * step - half });
  const indexOf = ({ x, z }) => Math.round((z + half) / step) * columns + Math.round((x + half) / step);
  const open = new Uint8Array(columns * columns);
  for (let i = 0; i < open.length; i++) {
    const position = point(i);
    open[i] = Number(!area.collision.some((shape) => !shape.activation && circleOverlapsWorldCollision(position, 0.5, shape)));
    if (open[i]) assert.ok(greenhavenGroundHeight(position.x, position.z) >= -0.01, `Traversable plateau sinks at ${JSON.stringify(position)}.`);
  }
  const start = indexOf({ x: 0, z: 0 });
  assert.ok(open[start], 'The initial hero position must stay clear.');
  const reached = new Set([start]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    for (const next of [current - columns, current + columns, ...(current % columns ? [current - 1] : []), ...(current % columns < columns - 1 ? [current + 1] : [])]) {
      if (next < 0 || next >= open.length || !open[next] || reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  const destinations = [
    ...config.SPAWNS.filter((spawn) => spawn.areaId === 1),
    { id: 'north bridge approach', x: 10.8, z: -27 },
    { id: 'east gate approach', x: 33, z: 3.6 },
    { id: 'west scenic gate', x: -34, z: -5.4 },
    { id: 'south rift bridge landing', x: 7.2, z: 27 },
  ];
  for (const destination of destinations) assert.ok(reached.has(indexOf(destination)), `Greenhaven strands ${destination.id}.`);
  for (const scatter of layout.scatters) {
    for (const placement of expandWorldScatter(scatter)) {
      assert.ok(!scatter.exclusions?.some(({ center, radius }) => Math.hypot(placement.position[0] - center[0], placement.position[2] - center[1]) < radius), `${placement.name} entered a clearing.`);
    }
  }
  assert.equal(expandWorldScatter({ prefix: 'excluded', props: ['nature.greenhavenPineA'], count: 3, bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 }, seed: 1, scale: [1, 1], exclusions: [{ center: [0, 0], radius: 5 }] }).length, 0, 'Exhausted scatter attempts must not populate excluded water.');
  const bytes = await readFile('public/assets/world/shared/models/greenhaven-landscape.glb');
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const primitives = document.meshes.flatMap((mesh) => mesh.primitives);
  const triangles = primitives.reduce((sum, primitive) => sum + document.accessors[primitive.indices].count / 3, 0);
  assert.ok(primitives.length <= 3 && triangles < 60000 && bytes.length < 5 * 1024 * 1024, 'Landscape exceeded its three-batch / 60k triangle / 5 MiB budget.');
  assert.ok(primitives.every((primitive) => primitive.attributes.COLOR_0 !== undefined), 'Portable landscape colors were lost during export.');
  await validateDressing(vite, layout);
  console.log(`Greenhaven: all ${destinations.length} spawn/exit destinations reachable; landscape ${triangles} triangles, ${(bytes.length / 1024 / 1024).toFixed(2)} MiB.`);
}

async function validateDressing(vite, layout) {
  const [{ expandWorldScatter }, { sampleWorldRoad }, { batchWorldDressing }, THREE] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/WorldLayout.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldGeometry.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldDressingInstances.ts'),
    import('three'),
  ]);
  const placements = layout.scatters.flatMap(expandWorldScatter);
  const trees = placements.filter((p) => p.name.startsWith('A01_Tree'));
  const grass = layout.props.filter((p) => p.prop === 'nature.greenhavenGrassPatch');
  assert.ok(trees.length >= 125 && trees.length <= 160, 'Keep the denser tree composition within its budget.');
  assert.equal(grass.length, trees.length, 'Each accepted tree needs its derived grass patch.');
  const roads = layout.roads.map((road) => ({ samples: sampleWorldRoad(road), radius: road.width / 2 }));
  const { WORLD_LAYOUTS } = await vite.ssrLoadModule('/src/data/world/index.ts');
  for (const road of WORLD_LAYOUTS.flatMap((chunk) => chunk.roads)) {
    const samples = sampleWorldRoad(road);
    const previous = new THREE.CatmullRomCurve3(road.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal').getPoints(samples.length - 1);
    assert.ok(samples.every((point, index) => point.distanceTo(previous[index]) < 1e-7), `${road.name} changed shape when sharing the road sampler.`);
  }
  for (const placement of [...placements, ...grass]) {
    const [x, , z] = placement.position;
    const radius = placement.name.endsWith('_Grass') ? 1.8 * placement.scale : placement.name.startsWith('A01_Tree') ? 1.5 : 0.55;
    assert.ok(roads.every((road) => road.samples.every((point) => Math.hypot(x - point.x, z - point.z) >= road.radius + radius)), `${placement.name} crowds a rendered lane.`);
    assert.ok(z + radius <= 30, `${placement.name} extends over the rift.`);
  }
  let totalBytes = 0;
  for (const suffix of ['grass-patch', 'shrub-a', 'shrub-b', 'mushrooms', 'fallen-log', 'stump']) {
    const bytes = await readFile(`public/assets/world/shared/models/greenhaven-${suffix}.glb`);
    totalBytes += bytes.length;
    const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    assert.equal(doc.meshes.flatMap((mesh) => mesh.primitives).length, 1);
    assert.equal(doc.materials.length, 1);
    assert.equal(doc.images?.length ?? 0, 0, 'Dressing should not add texture memory.');
  }
  assert.ok(totalBytes < 160 * 1024, 'Dressing exceeded the combined 160 KiB budget.');

  // Ensure batching retains all transforms under a translated/rotated area root,
  // preserves fallback/occluder roots and leaves cached GPU resources reusable.
  const parent = new THREE.Group();
  parent.position.set(36, 0, 60);
  parent.rotation.y = 0.4;
  const group = new THREE.Group();
  parent.add(group);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial();
  const expected = [];
  for (let i = 0; i < 3; i++) {
    const root = new THREE.Group();
    root.name = `Dressing_${i}`;
    root.userData.propKey = 'nature.greenhavenShrubA';
    root.position.set(i * 3, 0.025, -i);
    root.rotation.y = i * 0.7;
    root.scale.setScalar(0.6 + i * 0.2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.3;
    root.add(mesh);
    group.add(root);
    parent.updateMatrixWorld(true);
    expected.push(mesh.matrixWorld.clone());
  }
  const fallback = new THREE.Group();
  fallback.userData = { propKey: 'nature.greenhavenShrubA', worldAssetFallback: true };
  const tree = new THREE.Group();
  tree.userData.propKey = 'nature.greenhavenPineA';
  tree.add(new THREE.Mesh(geometry, material));
  group.add(fallback, tree);
  batchWorldDressing(group);
  parent.updateMatrixWorld(true);
  const batch = group.children.find((child) => child instanceof THREE.InstancedMesh);
  assert.ok(batch && batch.count === 3 && group.children.includes(fallback) && group.children.includes(tree));
  for (let i = 0; i < batch.count; i++) {
    const matrix = new THREE.Matrix4();
    batch.getMatrixAt(i, matrix);
    matrix.premultiply(batch.matrixWorld);
    assert.ok(matrix.elements.every((value, index) => Math.abs(value - expected[i].elements[index]) < 1e-5));
  }
  assert.equal(batch.geometry, geometry);
  assert.equal(batch.material, material);
  batch.dispose(); geometry.dispose(); material.dispose();
  console.log(`Greenhaven dressing: ${trees.length} trees/grass rings; ${(totalBytes / 1024).toFixed(1)} KiB new assets; rendered lanes, rift clearance and instance transforms passed.`);
}
