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
    { id: 'south scenic bridge', x: 7.2, z: 34 },
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
  console.log(`Greenhaven: all ${destinations.length} spawn/exit destinations reachable; landscape ${triangles} triangles, ${(bytes.length / 1024 / 1024).toFixed(2)} MiB.`);
}
