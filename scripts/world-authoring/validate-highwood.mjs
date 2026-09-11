import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Scenery must not strand encounters, block either bridge, or raise the floor. */
export async function validateHighwood(vite, config) {
  const [{ AREA_A02_LAYOUT: layout }, { circleOverlapsWorldCollision }, { worldTerrainHeight }, { expandWorldScatter }] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/areas/areaA02Layout.ts'),
    vite.ssrLoadModule('/src/domain/world/CollisionMath.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldGeometry.ts'),
    vite.ssrLoadModule('/src/data/world/WorldLayout.ts'),
  ]);
  const area = config.AREAS.find((candidate) => candidate.id === 2);
  const step = 0.5, minX = -71, minZ = -23, columns = 285, rows = 83;
  const localPoint = (i) => ({ x: i % columns * step + minX, z: Math.floor(i / columns) * step + minZ });
  const indexOf = ({ x, z }) => Math.round((z - minZ) / step) * columns + Math.round((x - minX) / step);
  const open = new Uint8Array(columns * rows);
  for (let i = 0; i < open.length; i++) {
    const local = localPoint(i);
    const point = { x: local.x + area.originX, z: local.z + area.originZ };
    open[i] = Number(!area.collision.some((shape) => !shape.activation && circleOverlapsWorldCollision(point, 0.5, shape)));
    if (open[i]) assert.ok(Math.abs(worldTerrainHeight(layout, local.x, local.z)) < 0.025, `Highwood floor disagrees with simulation at ${JSON.stringify(local)}.`);
  }
  const start = indexOf({ x: -25.2, z: 15 });
  assert.ok(open[start], 'The woodland bridge landing must remain open.');
  const reached = new Set([start]), queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    for (const next of [current - columns, current + columns, ...(current % columns ? [current - 1] : []), ...(current % columns < columns - 1 ? [current + 1] : [])]) {
      if (next < 0 || next >= open.length || !open[next] || reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  const destinations = [
    ...config.SPAWNS.filter((spawn) => spawn.areaId === 2).map((spawn) => ({ id: spawn.id, x: spawn.x - area.originX, z: spawn.z - area.originZ })),
    { id: 'keep bridge approach', x: 43.2, z: 18 },
    { id: 'western lookout', x: -60, z: 10 },
    { id: 'eastern loop', x: 62, z: 6 },
  ];
  for (const destination of destinations) assert.ok(reached.has(indexOf(destination)), `Highwood strands ${destination.id}.`);
  for (const scatter of layout.scatters) for (const placement of expandWorldScatter(scatter)) {
    assert.ok(!scatter.exclusions?.some(({ center, radius }) => Math.hypot(placement.position[0] - center[0], placement.position[2] - center[1]) < radius), `${placement.name} entered a clearing.`);
  }
  const bytes = await readFile('public/assets/world/shared/models/highwood-landscape.glb');
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const primitives = document.meshes.flatMap((mesh) => mesh.primitives);
  const triangles = primitives.reduce((sum, primitive) => sum + document.accessors[primitive.indices].count / 3, 0);
  assert.equal(document.scenes.length, 1, 'Export must contain only the authored scene.');
  assert.ok(primitives.length <= 4 && triangles < 45000 && bytes.length < 4 * 1024 * 1024, 'Highwood exceeded its four-batch / 45k triangle / 4 MiB budget.');
  assert.ok(primitives.every((primitive) => primitive.attributes.COLOR_0 !== undefined), 'Highwood portable colors were lost.');
  console.log(`Highwood: all ${destinations.length} spawn/exit destinations reachable; landscape ${triangles} triangles, ${(bytes.length / 1024 / 1024).toFixed(2)} MiB.`);
}
