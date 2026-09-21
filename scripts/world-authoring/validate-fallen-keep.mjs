import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Check traversable interiors, encounter clearings and unchanged existing spawns. */
export async function validateFallenKeep(vite, config) {
  const [{ AREA_A03_LAYOUT: layout }, { circleOverlapsWorldCollision }, { worldTerrainHeight }, { expandWorldScatter }, { worldWalkHeight }] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/areas/areaA03Layout.ts'),
    vite.ssrLoadModule('/src/domain/world/CollisionMath.ts'),
    vite.ssrLoadModule('/src/rendering/environment/WorldGeometry.ts'),
    vite.ssrLoadModule('/src/data/world/WorldLayout.ts'),
    vite.ssrLoadModule('/src/domain/world/WorldWalkSurface.ts'),
  ]);
  const area = config.AREAS.find((candidate) => candidate.id === 3);
  const horizon = layout.surfaces?.find((surface) => surface.name === 'A03_East_Cliff_Horizon');
  assert.ok(horizon && horizon.kind === 'cliff', 'Fallen Keep needs its collision-free eastern cliff horizon.');
  assert.equal(horizon.center[0] - horizon.size.width / 2, 42, 'The eastern cliff horizon must meet the visual terrain edge.');
  assert.ok(horizon.center[0] + horizon.size.width / 2 >= 120, 'The eastern cliff horizon must end beyond runtime fog.');
  assert.ok(horizon.center[1] - horizon.size.depth / 2 <= -120 && horizon.center[1] + horizon.size.depth / 2 >= 112, 'The eastern cliff horizon must cover every Area 3 camera latitude.');
  assert.ok((horizon.elevation ?? 0) < -4.2, 'The eastern cliff horizon must remain below the authored cliff base.');
  const columns = 141, step = .5, minimum = -35;
  const pointAt = (i) => ({ x: i % columns * step + minimum, z: Math.floor(i / columns) * step + minimum });
  const indexOf = ({ x, z }) => Math.round((z - minimum) / step) * columns + Math.round((x - minimum) / step);
  const open = new Uint8Array(columns * columns);
  for (let i = 0; i < open.length; i++) {
    const local = pointAt(i), world = { x: local.x + area.originX, z: local.z + area.originZ };
    open[i] = Number(!area.collision.some((shape) => !shape.activation && circleOverlapsWorldCollision(world, .5, shape)));
    if (open[i] && worldWalkHeight(area.walkSurfaces, world) === 0) assert.equal(worldTerrainHeight(layout, local.x, local.z), 0, 'Keep paving must agree with the simulation floor away from the bridge.');
  }
  const start = indexOf({ x: -34, z: 3.6 });
  assert.ok(open[start], 'West gate landing is blocked.');
  const reached = new Set([start]), queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    for (const next of [current - columns, current + columns, ...(current % columns ? [current - 1] : []), ...(current % columns < columns - 1 ? [current + 1] : [])]) {
      if (next < 0 || next >= open.length || !open[next] || reached.has(next)) continue;
      reached.add(next); queue.push(next);
    }
  }
  const destinations = [
    ...config.SPAWNS.filter((spawn) => spawn.areaId === 3).map((spawn) => ({ id: spawn.id, x: spawn.x - area.originX, z: spawn.z - area.originZ })),
    ...layout.encounterSpots.map((spot) => ({ id: spot.id, x: spot.center[0], z: spot.center[1] })),
    { id: 'north gate landing', x: 7.2, z: -32 },
    { id: 'south gate landing', x: 14, z: 27 },
    { id: 'west cottage interior', x: -17, z: 25 },
    { id: 'east cottage interior', x: 27, z: 24 },
    { id: 'guardhouse interior', x: -27, z: -5.5 },
  ];
  for (const destination of destinations) assert.ok(reached.has(indexOf(destination)), `Fallen Keep strands ${destination.id}.`);
  assert.equal(new Set(layout.encounterSpots.map((spot) => spot.id)).size, layout.encounterSpots.length, 'Encounter IDs must be unique.');
  for (const spot of layout.encounterSpots) {
    assert.ok(spot.radius > 0 && Math.abs(spot.center[0]) + spot.radius < 36 && Math.abs(spot.center[1]) + spot.radius < 36, `${spot.id} is outside the keep.`);
    const world = { x: spot.center[0] + area.originX, z: spot.center[1] + area.originZ };
    assert.ok(!area.collision.some((shape) => !shape.activation && circleOverlapsWorldCollision(world, spot.radius, shape)), `${spot.id} lacks its reserved clear radius.`);
    for (const scatter of layout.scatters) for (const placement of expandWorldScatter(scatter)) {
      assert.ok(Math.hypot(placement.position[0] - spot.center[0], placement.position[2] - spot.center[1]) >= spot.radius, `${placement.name} entered ${spot.id}.`);
    }
  }
  const assets = ['wall-a','wall-b','corner','gate','cottage','barracks','chapel','hall','landscape','siege-debris'];
  let totalBytes = 0, totalTriangles = 0;
  for (const asset of assets) {
    const bytes = await readFile(`public/assets/world/shared/models/fallen-keep-${asset}.glb`);
    const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
    const primitives = document.meshes.flatMap((mesh) => mesh.primitives);
    assert.equal(document.scenes.length, 1, 'Exports must contain only the authored scene.');
    assert.ok(primitives.length <= (asset === 'landscape' ? 4 : 1), `${asset} exceeded its draw budget.`);
    assert.ok(!(document.images ?? []).some((image) => image.uri) && !(document.buffers ?? []).some((buffer) => buffer.uri), `${asset} has external dependencies.`);
    totalBytes += bytes.length;
    totalTriangles += primitives.reduce((sum, primitive) => sum + document.accessors[primitive.indices].count / 3, 0);
  }
  assert.ok(totalBytes < 6 * 1024 * 1024 && totalTriangles < 85000, 'Fallen Keep exceeded its 6 MiB / 85k unique triangle budget.');
  console.log(`Fallen Keep: ${destinations.length} destinations reachable, ${layout.encounterSpots.length} reserved clearings; ${totalTriangles} unique triangles / ${(totalBytes / 1048576).toFixed(2)} MiB.`);
}
