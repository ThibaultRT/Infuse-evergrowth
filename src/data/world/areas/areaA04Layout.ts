import { AREA4_ORIGIN, AREA4_SPEC, RIFT_SOUTH_Z, area4RiftCutout } from '../area4';
import type { AreaWorldLayout, WorldPropPlacement } from '../WorldLayout';

const { bridge, crossings, throne, lavaPools } = AREA4_SPEC;
const westLanding = crossings.greenhavenX - AREA4_ORIGIN[0];
const eastLanding = 72 + crossings.fallenKeepLocalX - AREA4_ORIGIN[0];
const landingZ = RIFT_SOUTH_Z + bridge.approachLength - AREA4_ORIGIN[2];
const trees: readonly (readonly [number, number])[] = [[-64, -5], [-61, 14], [-44, 18], [-41, -7], [-18, -6], [-12, 18], [13, 18], [20, -6], [36, 16], [62, -6], [65, 16], [-57, -7]];

export const AREA_A04_LAYOUT = {
  kind: 'area', id: 'area:A04', areaId: 4, name: 'Area 4 — Burned Forest',
  origin: AREA4_ORIGIN, playableSize: AREA4_SPEC.playableSize, visualSize: AREA4_SPEC.visualSize,
  terrain: 'ash',
  terrainCutouts: [area4RiftCutout('A04_North_Rift', AREA4_ORIGIN)],
  roads: [
    { name: 'A04_West_Approach', points: [[westLanding, landingZ], [westLanding, -4], [-14, 2], [0, 4]], width: bridge.width, material: 'ash' },
    { name: 'A04_East_Approach', points: [[eastLanding, landingZ], [eastLanding, -3], [26, 3], [0, 4]], width: bridge.width, material: 'ash' },
    { name: 'A04_Throne_Approach', points: [[0, 4], [0, 10]], width: 4, material: 'ash' },
  ],
  encounterSpots: [
    { id: 'A04_Clearing_Central', name: 'Open ash clearing', center: [0, 0], radius: 5 },
    { id: 'A04_Clearing_Throne', name: 'Throne approach', center: [0, 8], radius: 3 },
  ],
  props: [
    { name: 'A04_Ancient_Throne', prop: 'blockout.throne', position: [throne.center[0], 0, throne.center[1]] },
    ...lavaPools.map((pool): WorldPropPlacement => ({ name: pool.id, prop: 'blockout.lavaPool', position: [pool.center[0], 0, pool.center[1]], scale: pool.radius })),
    ...trees.map(([x, z], index): WorldPropPlacement => ({ name: `A04_CharredTree_${String(index + 1).padStart(2, '0')}`, prop: 'blockout.charredTree', position: [x, 0, z], scale: 0.8 + (index % 3) * 0.2, rotation: index * 1.7 })),
  ],
  scatters: [],
  collision: [],
} as const satisfies AreaWorldLayout;
