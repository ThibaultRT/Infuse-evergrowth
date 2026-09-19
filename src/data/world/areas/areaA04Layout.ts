import { AREA4_ORIGIN, AREA4_SPEC, RIFT_SOUTH_Z, area4RiftCutout } from '../area4';
import type { AreaWorldLayout, WorldEncounterSpot, WorldPropPlacement, WorldRoadPlacement } from '../WorldLayout';
import { createArea4ForestScatters } from '../area4Forest';

const { bridge, crossings, throne, lavaPools } = AREA4_SPEC;
const westLanding = crossings.greenhavenX - AREA4_ORIGIN[0];
const eastLanding = 72 + crossings.fallenKeepLocalX - AREA4_ORIGIN[0];
const landingZ = RIFT_SOUTH_Z + bridge.approachLength - AREA4_ORIGIN[2];
const roads: readonly WorldRoadPlacement[] = [
  { name: 'A04_West_Approach', points: [[westLanding, landingZ], [westLanding, -4], [-14, 2], [0, 4]], width: bridge.width, material: 'ash' },
  { name: 'A04_East_Approach', points: [[eastLanding, landingZ], [eastLanding, -3], [26, 3], [0, 4]], width: bridge.width, material: 'ash' },
  { name: 'A04_Throne_Approach', points: [[0, 4], [0, 10]], width: 4, material: 'ash' },
];
const encounterSpots: readonly WorldEncounterSpot[] = [
  { id: 'A04_Clearing_Central', name: 'Open ash clearing', center: [0, 0], radius: 5 },
  { id: 'A04_Clearing_Throne', name: 'Throne approach', center: [0, 8], radius: 3 },
];

export const AREA_A04_LAYOUT = {
  kind: 'area', id: 'area:A04', areaId: 4, name: 'Area 4 — Burned Forest',
  origin: AREA4_ORIGIN, playableSize: AREA4_SPEC.playableSize, visualSize: AREA4_SPEC.visualSize,
  terrain: 'ash',
  terrainCutouts: [area4RiftCutout('A04_North_Rift', AREA4_ORIGIN)],
  roads,
  encounterSpots,
  props: [
    { name: 'A04_Ancient_Throne', prop: 'ruin.ancientThrone', position: [throne.center[0], 0, throne.center[1]] },
    ...lavaPools.map((pool, index): WorldPropPlacement => ({ name: pool.id, prop: 'terrain.lavaBasin', position: [pool.center[0], 0, pool.center[1]], scale: pool.radius, rotation: index * 2.1 })),
  ],
  scatters: createArea4ForestScatters(roads, encounterSpots),
  collision: [],
} as const satisfies AreaWorldLayout;
