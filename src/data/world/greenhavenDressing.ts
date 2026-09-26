import area from '../areas/area-1.json';
import { MINION_PIT } from './minionPit';
import { GREENHAVEN_ROADS } from './greenhaven';
import terrain from './greenhaven.json';
import { expandWorldScatter, type WorldPropPlacement, type WorldScatterPlacement } from './WorldLayout';
import { sampleRoadPoints } from '../../domain/world/WorldRoad';

/** Protect the entire rendered curve, including the bends between control points. */
export function greenhavenClearings(props: readonly WorldPropPlacement[], verge: number): NonNullable<WorldScatterPlacement['exclusions']> {
  return [
    { center: [terrain.lake.center[0], terrain.lake.center[1]], radius: terrain.lake.radius + verge + 0.5 },
    { center: [terrain.plaza.center[0], terrain.plaza.center[1]], radius: terrain.plaza.radius + verge },
    { center: [MINION_PIT.x, MINION_PIT.z], radius: MINION_PIT.diameter / 2 + verge + 0.8 },
    ...area.spawns.map((spawn) => ({ center: [spawn.x, spawn.z] as const, radius: (spawn.id === area.bossSpawnId ? 2.8 : 1.6) + verge })),
    ...props.filter(({ prop }) => /village\.(warmHome|homeBlue|blacksmith|market)/.test(prop)).map(({ position, scale }) => ({
      center: [position[0], position[2]] as const, radius: 3.2 * (scale ?? 1) + verge,
    })),
    ...terrain.gardens.map(({ center, width, depth }) => ({ center: [center[0], center[1]] as const, radius: Math.hypot(width, depth) / 2 + verge })),
    ...GREENHAVEN_ROADS.flatMap((road) => sampleRoadPoints(road.points, (road.points.length - 1) * 32).map((center) => ({
      center, radius: road.width / 2 + verge + 0.2,
    }))),
  ];
}

/** Every grass ring follows its tree's accepted transform, including scatter exclusions. */
export function greenhavenTreeGrass(scatters: readonly WorldScatterPlacement[]): WorldPropPlacement[] {
  return scatters.filter(({ prefix }) => prefix.startsWith('A01_Tree')).flatMap(expandWorldScatter).map((tree) => ({
    name: `${tree.name}_Grass`, prop: 'nature.greenhavenGrassPatch', position: tree.position,
    rotation: tree.rotation, scale: Math.min(1.05, tree.scale ?? 1), collision: 'none',
  }));
}
