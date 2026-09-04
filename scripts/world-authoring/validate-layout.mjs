import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createServer } from 'vite';

const repositoryRoot = process.cwd();
const vite = await createServer({ root: repositoryRoot, configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'silent' });
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

try {
  const [{ WORLD_LAYOUTS }, { validateWorldLayouts }, { compileWorldCollision }, config, collisionMath, placementMath, { WORLD_PROP_CATALOG }, { WORLD_ASSET_DEFINITIONS }] = await Promise.all([
    vite.ssrLoadModule('/src/data/world/index.ts'),
    vite.ssrLoadModule('/src/data/world/validateWorld.ts'),
    vite.ssrLoadModule('/src/domain/world/WorldCollisionCompiler.ts'),
    vite.ssrLoadModule('/src/config.ts'),
    vite.ssrLoadModule('/src/domain/world/CollisionMath.ts'),
    vite.ssrLoadModule('/src/domain/world/WorldPlacement.ts'),
    vite.ssrLoadModule('/src/data/world/WorldPropCatalog.ts'),
    vite.ssrLoadModule('/src/data/world/WorldAssetKeys.ts'),
  ]);

  errors.push(...validateWorldLayouts(WORLD_LAYOUTS).filter((issue) => issue.severity === 'error').map((issue) => issue.message));
  const compiled = compileWorldCollision(WORLD_LAYOUTS);
  check(JSON.stringify(compiled) === JSON.stringify(compileWorldCollision(WORLD_LAYOUTS)), 'Collision compilation is not deterministic.');
  check(new Set(compiled.all.map((shape) => shape.id)).size === compiled.all.length, 'Compiled collision IDs are not unique.');

  const expected = new Map([
    ['area:A01', { origin: [0, 0, 0], visual: [84, 84], playable: [72, 72] }],
    ['area:A02', { origin: [36, 0, -60], visual: [156, 60], playable: [144, 48] }],
    ['area:A03', { origin: [72, 0, 0], visual: [84, 84], playable: [72, 72] }],
    ['transition:A01-A02', { origin: [0, 0, -36], visual: [84, 12] }],
    ['transition:A01-A03', { origin: [36, 0, 0], visual: [12, 84] }],
    ['transition:A02-A03', { origin: [72, 0, -36], visual: [84, 12] }],
  ]);
  check(WORLD_LAYOUTS.length === expected.size, `Expected six world chunks, found ${WORLD_LAYOUTS.length}.`);
  for (const layout of WORLD_LAYOUTS) {
    const contract = expected.get(layout.id);
    check(Boolean(contract), `Unexpected world chunk ${layout.id}.`);
    if (!contract) continue;
    check(JSON.stringify(layout.origin) === JSON.stringify(contract.origin), `${layout.id} has the wrong world root.`);
    check(layout.visualSize.width === contract.visual[0] && layout.visualSize.depth === contract.visual[1], `${layout.id} has the wrong visual dimensions.`);
    if (layout.kind === 'area' && contract.playable) check(layout.playableSize.width === contract.playable[0] && layout.playableSize.depth === contract.playable[1], `${layout.id} has the wrong playable dimensions.`);
  }

  const placementNames = new Set();
  const referencedAssets = new Set([
    'terrain.meadowColor', 'terrain.meadowNormal', 'terrain.forestColor', 'terrain.forestNormal',
    'terrain.trailColor', 'terrain.trailNormal', 'terrain.cobbleColor', 'terrain.cobbleNormal',
  ]);
  for (const layout of WORLD_LAYOUTS) {
    for (const placement of [...layout.props, ...layout.scatters.flatMap((scatter) => scatter.props.map((prop, index) => ({ name: `${scatter.prefix}:${index}`, prop })))]) {
      check(!placementNames.has(placement.name), `Placement name is not globally unique: ${placement.name}`);
      placementNames.add(placement.name);
      const definition = WORLD_PROP_CATALOG[placement.prop];
      check(Boolean(definition), `Unknown prop key ${placement.prop}.`);
      if (definition) referencedAssets.add(definition.asset);
    }
  }

  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'public', 'assets', 'world', 'asset-manifest.json'), 'utf8'));
  const promoted = new Set(manifest.assets.map((entry) => entry.key));
  for (const key of referencedAssets) {
    const definition = WORLD_ASSET_DEFINITIONS[key];
    check(Boolean(definition), `Referenced asset ${key} has no asset definition.`);
    check(promoted.has(key), `Referenced asset ${key} is not in the runtime promotion manifest.`);
    if (definition) await stat(path.join(repositoryRoot, 'public', definition.runtime)).catch(() => errors.push(`Referenced runtime asset is missing: ${definition.runtime}`));
  }

  for (const area of config.AREAS) {
    const areaSpawns = config.SPAWNS.filter((spawn) => spawn.areaId === area.id);
    for (const spawn of areaSpawns) {
      check(Math.abs(spawn.x - area.originX) <= area.size.width / 2 - 0.8 && Math.abs(spawn.z - area.originZ) <= area.size.depth / 2 - 0.8, `${spawn.id} is outside its playable area.`);
      const overlap = area.collision.find((shape) => !shape.activation && collisionMath.circleOverlapsWorldCollision(spawn, 0.8, shape));
      check(!overlap, `${spawn.id} overlaps ${overlap?.id}.`);
    }
  }

  for (const connection of config.WORLD_CONNECTIONS) {
    const area = config.AREAS.find((candidate) => candidate.id === connection.areaAId);
    check(Boolean(area), `${connection.id} has no source area.`);
    if (!area) continue;
    for (let offset = -5; offset <= 5; offset += 0.5) {
      const point = connection.axis === 'z' ? { x: connection.x, z: connection.z + offset } : { x: connection.x + offset, z: connection.z };
      const overlap = area.collision.find((shape) => !shape.activation && collisionMath.circleOverlapsWorldCollision(point, 0.45, shape));
      check(!overlap, `${connection.id} centerline is obstructed by ${overlap?.id}.`);
    }
    check(compiled.all.some((shape) => shape.activation?.connectionId === connection.id), `${connection.id} has no state-dependent locked barrier.`);
  }

  const keep = config.AREAS.find((area) => area.id === 3);
  check(Boolean(keep), 'Area 3 is missing.');
  if (keep) {
    for (let offset = -35.5; offset <= 35.5; offset += 1) {
      const samples = [
        { side: 'west', point: { x: 36, z: offset }, gate: Math.abs(offset - 3.6) < 3.4 },
        { side: 'east', point: { x: 107.5, z: offset }, gate: false },
        { side: 'north', point: { x: 72 + offset, z: -35.5 }, gate: Math.abs(offset - 7.2) < 3.4 },
        { side: 'south', point: { x: 72 + offset, z: 35.5 }, gate: false },
      ];
      for (const sample of samples) {
        if (sample.gate) continue;
        check(keep.collision.some((shape) => !shape.activation && collisionMath.circleOverlapsWorldCollision(sample.point, 0.45, shape)), `Area 3 perimeter gap at ${sample.side}:${offset}.`);
      }
    }
  }

  const transformed = placementMath.transformWorldPoint([2, 0], { position: [10, 0, 20], rotation: Math.PI / 2, scale: 2 });
  check(Math.abs(transformed[0] - 10) < 1e-8 && Math.abs(transformed[1] - 16) < 1e-8, 'Shared placement transform rotation/scale check failed.');
  check(collisionMath.circleOverlapsWorldCollision({ x: 0.9, z: 0 }, 0.2, { id: 'test', sourceChunkId: 'test', kind: 'rectangle', x: 0, z: 0, width: 2, depth: 1, rotation: Math.PI / 4 }), 'Oriented-rectangle collision check failed.');
  check(collisionMath.circleOverlapsWorldCollision({ x: 1.1, z: 0 }, 0.2, { id: 'test', sourceChunkId: 'test', kind: 'circle', x: 0, z: 0, radius: 1 }), 'Circle collision check failed.');

  for (const id of [1, 2, 3]) {
    const areaData = JSON.parse(await readFile(path.join(repositoryRoot, 'src', 'data', 'areas', `area-${id}.json`), 'utf8'));
    check(!('worldOrigin' in areaData), `area-${id}.json still duplicates worldOrigin.`);
    check(!('size' in areaData), `area-${id}.json still duplicates playable size.`);
    check(!('collision' in areaData), `area-${id}.json still duplicates structural collision.`);
  }

  if (errors.length > 0) throw new Error(`World validation failed:\n${errors.join('\n')}`);
  console.log(`World validation passed: ${WORLD_LAYOUTS.length} chunks, ${placementNames.size} named authored/scatter groups, ${compiled.all.length} colliders, ${config.SPAWNS.length} spawns, ${referencedAssets.size} promoted assets.`);
} finally {
  await vite.close();
}
