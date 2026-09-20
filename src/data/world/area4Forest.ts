import spec from './area4-forest.json';
import encounters from '../areas/area-4.json';
import { AREA4_SPEC } from './area4';
import { AREA4_BOUNDARY_SPEC, AREA4_EAST_GATE_PLACEMENT, AREA4_SOUTH_GROUND_Z } from './area4Boundaries';
import { AREA4_GROVE_PLACEMENTS, AREA4_GROVE_VISUAL_RADIUS } from './area4Groves';
import { expandWorldScatter, type WorldEncounterSpot, type WorldRoadPlacement, type WorldScatterPlacement } from './WorldLayout';

export const AREA4_FOREST_SPEC = spec;

/** Conservative canopy/footprint reservations; independent of model loading. */
export function createArea4ForestScatters(roads: readonly WorldRoadPlacement[], spots: readonly WorldEncounterSpot[]): WorldScatterPlacement[] {
  const { scatter, props } = spec;
  const reserved = [
    { center: [AREA4_EAST_GATE_PLACEMENT.position[0], AREA4_EAST_GATE_PLACEMENT.position[2]] as const, radius: AREA4_BOUNDARY_SPEC.gate.width / 2 + 2 },
    ...AREA4_GROVE_PLACEMENTS.map(({ position: [x, , z], scale }) => ({ center: [x, z] as const, radius: AREA4_GROVE_VISUAL_RADIUS * (scale ?? 1) + scatter.separation })),
    ...spots.map(({ center, radius }) => ({ center, radius: radius + scatter.clearingMargin })),
    ...AREA4_SPEC.lavaPools.map(({ center, radius }) => ({ center: [center[0], center[1]] as const, radius: radius + scatter.clearingMargin })),
    { center: [AREA4_SPEC.throne.center[0], AREA4_SPEC.throne.center[1]] as const, radius: Math.hypot(AREA4_SPEC.throne.width, AREA4_SPEC.throne.depth) / 2 + 2 },
    ...encounters.spawns.map((spawn: { x: number; z: number }) => ({ center: [spawn.x, spawn.z] as const, radius: 4 })),
    // Sample the control polygon with enough margin for the rendered smooth bends.
    ...roads.flatMap((road) => road.points.slice(1).flatMap((to, index) => {
      const from = road.points[index];
      const count = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1])));
      return Array.from({ length: count + 1 }, (_, step) => ({
        center: [from[0] + (to[0] - from[0]) * step / count, from[1] + (to[1] - from[1]) * step / count] as const,
        radius: road.width / 2 + scatter.routeMargin,
      }));
    })),
  ];
  const groups: { prefix: string; props: WorldScatterPlacement['props']; tuning: typeof scatter.trunks; radius: number }[] = [
    { prefix: 'A04_CharredTrunks', props: ['nature.charredTrunkA', 'nature.charredTrunkB'], tuning: scatter.trunks, radius: props.trunkA.visualRadius },
    { prefix: 'A04_Stumps', props: ['nature.charredStump'], tuning: scatter.stumps, radius: props.stump.visualRadius },
    { prefix: 'A04_FallenLogs', props: ['nature.charredLog'], tuning: scatter.logs, radius: props.log.visualRadius },
    { prefix: 'A04_Basalt', props: ['nature.basaltA', 'nature.basaltB'], tuning: scatter.rocks, radius: props.basaltA.visualRadius },
  ];
  const occupied: { center: readonly [number, number]; radius: number }[] = [];
  return groups.map(({ prefix, props: keys, tuning, radius }) => {
    const extent = radius * tuning.scale[1];
    const group: WorldScatterPlacement = {
      prefix, props: keys, count: tuning.count, seed: tuning.seed,
      bounds: { ...scatter.bounds,
        maxX: Math.min(scatter.bounds.maxX, AREA4_SPEC.playableSize.width / 2 - AREA4_BOUNDARY_SPEC.gate.depth / 2 - extent - scatter.separation),
        maxZ: Math.min(scatter.bounds.maxZ, AREA4_SOUTH_GROUND_Z - extent - scatter.separation),
      }, scale: [tuning.scale[0], tuning.scale[1]], collision: 'prop-default',
      minSpacing: extent * 2 + scatter.separation,
      exclusions: [...reserved, ...occupied].map(({ center, radius: reservedRadius }) => ({ center, radius: reservedRadius + extent })),
    };
    occupied.push(...expandWorldScatter(group).map(({ position, scale }) => ({ center: [position[0], position[2]] as const, radius: radius * (scale ?? 1) + scatter.separation })));
    return group;
  });
}
