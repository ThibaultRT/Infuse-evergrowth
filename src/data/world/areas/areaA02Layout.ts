import type { AreaWorldLayout, WorldPropPlacement, WorldScatterPlacement } from '../WorldLayout';
import { A01_A02_TRANSITION } from '../transitions/a01A02Transition';
import { A02_A03_TRANSITION } from '../transitions/a02A03Transition';
import { clearTransitionApproaches, transitionTerrainCutouts } from '../transitionTerrainCutouts';
import { HIGHWOOD_ROADS } from '../highwood';
import terrain from '../highwood.json';
import encounters from '../../areas/area-2.json';

const origin = [36, 0, -60] as const;
const bareTrees = ['nature.highwoodBareA', 'nature.highwoodBareB', 'nature.highwoodBareC'] as const;
const pines = ['nature.highwoodPineA', 'nature.highwoodPineB'] as const;
const landmarks: readonly WorldPropPlacement[] = [
    { name: 'A02_Landscape', prop: 'terrain.highwood', position: [0, 0, 0] },
    { name: 'A02_Watchtower_West', prop: 'wilds.timberWatchtower', position: [-53, 0, -17], rotation: 0.45, scale: 0.94 },
    { name: 'A02_Watchtower_Shore', prop: 'wilds.timberWatchtower', position: [-37, 0, 4], rotation: -0.6, scale: 0.88 },
    { name: 'A02_Watchtower_North', prop: 'wilds.timberWatchtower', position: [13, 0, -20], rotation: 0.6, scale: 0.92 },
    { name: 'A02_Watchtower_East', prop: 'wilds.timberWatchtower', position: [56, 0, -18], rotation: -0.5, scale: 0.98 },
    { name: 'A02_Watchtower_River', prop: 'wilds.timberWatchtower', position: [57, 0, 5], rotation: 0.4, scale: 0.86 },
    { name: 'A02_Camp_Tent', prop: 'prop.tent', position: [39, 0, -4], rotation: -0.7, scale: 0.85 },
    { name: 'A02_Camp_Crate', prop: 'prop.crate', position: [42, 0, -3], rotation: 0.6, scale: 0.66 },
    { name: 'A02_Camp_Barrel', prop: 'prop.barrel', position: [36.5, 0, -2.8], rotation: 0.15, scale: 0.72 },
    { name: 'A02_Abandoned_Lumber', prop: 'prop.lumber', position: [-49, 0, -16], rotation: -0.2, scale: 0.72 },
    { name: 'A02_Ruined_Wall', prop: 'ruin.dungeonWallBroken', position: [64, 0, 11], rotation: -0.3, scale: 1.1 },
    { name: 'A02_Ruined_Rubble', prop: 'ruin.rubbleHalf', position: [66, 0, 10], scale: 1.1 },
    { name: 'A02_Standing_Stone_West', prop: 'nature.greenhavenBoulder', position: [-34, 0, -15], scale: 1.45 },
    { name: 'A02_Standing_Stone_East', prop: 'nature.greenhavenBoulder', position: [35, 0, 3], rotation: 0.7, scale: 1.35 },
];

const clearings = [
  ...encounters.spawns.map((spawn) => ({ center: [spawn.x, spawn.z] as const, radius: spawn.id === encounters.bossSpawnId ? 4.5 : 2.4 })),
  ...terrain.rockMasses.map(({ center: [x, z], radius }) => ({ center: [x, z] as const, radius: radius + 1 })),
  ...HIGHWOOD_ROADS.flatMap((road) => road.points.slice(1).flatMap((to, index) => {
    const from = road.points[index];
    const count = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 1.5);
    return Array.from({ length: count + 1 }, (_, sample) => ({
      center: [from[0] + (to[0] - from[0]) * sample / count, from[1] + (to[1] - from[1]) * sample / count] as const,
      radius: road.width / 2 + 1.9,
    }));
  })),
  ...landmarks.filter(({ prop }) => prop === 'wilds.timberWatchtower' || prop === 'prop.tent').map(({ position: [x, , z] }) => ({ center: [x, z] as const, radius: 3.5 })),
];
const decorate = (scatter: WorldScatterPlacement): WorldScatterPlacement => ({
  ...scatter, exclusions: [...clearings, ...scatter.exclusions ?? []],
});

export const AREA_A02_LAYOUT = {
  kind: 'area',
  id: 'area:A02',
  areaId: 2,
  name: 'Highwood — The Ashen Wilds',
  origin,
  playableSize: { width: 144, depth: 48 },
  visualSize: { width: 156, depth: 60 },
  terrain: 'forest',
  // The northern/western/eastern visual apron remains; the southern floor ends
  // at the shared river seam instead of overlapping both transition owners.
  terrainRegions: [{ name: 'A02_Forest_Ground', center: [0, -3], size: { width: 156, depth: 54 } }],
  terrainCutouts: [
    ...transitionTerrainCutouts(A01_A02_TRANSITION, origin),
    ...transitionTerrainCutouts(A02_A03_TRANSITION, origin),
  ],
  roads: HIGHWOOD_ROADS,
  props: landmarks,
  scatters: clearTransitionApproaches([
    decorate({ prefix: 'A02_Bare_West', props: bareTrees, count: 35, bounds: { minX: -70, maxX: -32, minZ: -22, maxZ: 16 }, seed: 211, scale: [0.8, 1.3], collision: 'prop-default' }),
    decorate({ prefix: 'A02_Bare_North', props: bareTrees, count: 42, bounds: { minX: -68, maxX: 71, minZ: -24, maxZ: -15 }, seed: 212, scale: [0.85, 1.35], collision: 'prop-default' }),
    decorate({ prefix: 'A02_Bare_East', props: bareTrees, count: 31, bounds: { minX: 30, maxX: 71, minZ: -21, maxZ: 16 }, seed: 213, scale: [0.8, 1.32], collision: 'prop-default' }),
    decorate({ prefix: 'A02_Bare_Interior', props: bareTrees, count: 30, bounds: { minX: -32, maxX: 31, minZ: -22, maxZ: 17 }, seed: 214, scale: [0.65, 1.1], collision: 'prop-default' }),
    decorate({ prefix: 'A02_Pine_West', props: pines, count: 18, bounds: { minX: -70, maxX: -42, minZ: -22, maxZ: 17 }, seed: 221, scale: [0.8, 1.25], collision: 'prop-default' }),
    decorate({ prefix: 'A02_Pine_North', props: pines, count: 31, bounds: { minX: -69, maxX: 70, minZ: -25, maxZ: -19 }, seed: 222, scale: [0.95, 1.4], collision: 'prop-default' }),
    decorate({ prefix: 'A02_Pine_East', props: pines, count: 21, bounds: { minX: 30, maxX: 71, minZ: -19, maxZ: 17 }, seed: 223, scale: [0.75, 1.2], collision: 'prop-default' }),
    decorate({ prefix: 'A02_Pine_Interior', props: pines, count: 12, bounds: { minX: -39, maxX: 31, minZ: -17, maxZ: 17 }, seed: 224, scale: [0.7, 1], collision: 'prop-default' }),
    decorate({ prefix: 'A02_Rock', props: ['nature.greenhavenBoulder'], count: 58, bounds: { minX: -70, maxX: 71, minZ: -23, maxZ: 17 }, seed: 225, scale: [0.35, 1.15], collision: 'prop-default' }),
  ], A01_A02_TRANSITION, origin),
  collision: [],
} as const satisfies AreaWorldLayout;
