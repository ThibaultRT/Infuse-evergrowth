import { createWallRun, type AreaWorldLayout } from '../WorldLayout';
import { FALLEN_KEEP_CLIFF_CUTOUTS, FALLEN_KEEP_ENCOUNTER_SPOTS, FALLEN_KEEP_ROADS } from '../fallenKeep';
import areaContent from '../../areas/area-3.json';

const clearings = [
  ...FALLEN_KEEP_ENCOUNTER_SPOTS.map(({ center, radius }) => ({ center, radius: radius + 1 })),
  ...areaContent.spawns.map(({ x, z }) => ({ center: [x, z] as const, radius: 2 })),
  { center: [7.2, -32] as const, radius: 6 },
];

export const AREA_A03_LAYOUT = {
  kind: 'area', id: 'area:A03', areaId: 3,
  name: 'The Fallen Keep — Citadel of Ash',
  origin: [72, 0, 0],
  playableSize: { width: 72, depth: 72 }, visualSize: { width: 84, depth: 84 },
  terrain: 'cobble',
  terrainCutouts: [
    { name: 'A03_Mosswater_Riverbed', center: [0, -37.5], size: { width: 84, depth: 8.5 }, elevation: 0 },
    ...FALLEN_KEEP_CLIFF_CUTOUTS,
  ],
  roads: FALLEN_KEEP_ROADS,
  encounterSpots: FALLEN_KEEP_ENCOUNTER_SPOTS,
  props: [
    { name: 'A03_Weathered_Courts', prop: 'terrain.fallenKeep', position: [0, 0, 0] },
    { name: 'A03_Castle_Ruined', prop: 'ruin.keepHall', position: [18, 0, -24] },
    { name: 'A03_Chapel_Ruin', prop: 'ruin.chapel', position: [0, 0, -22] },
    { name: 'A03_Ruined_Smithy', prop: 'ruin.cottage', position: [-27, 0, -17] },
    { name: 'A03_Ruined_House_West', prop: 'ruin.cottage', position: [-17, 0, 25] },
    { name: 'A03_Ruined_House_East', prop: 'ruin.cottage', position: [27, 0, 24] },
    { name: 'A03_Barracks', prop: 'ruin.barracks', position: [0, 0, 22] },
    { name: 'A03_West_Guardhouse', prop: 'ruin.cottage', position: [-27, 0, -5.5], scale: 0.65 },
    { name: 'A03_Siege_Wreck', prop: 'ruin.siegeDebris', position: [27, 0, -28], rotation: -0.3 },
    { name: 'A03_Rubble_North', prop: 'ruin.rubbleLarge', position: [-27, 0, -28], scale: 1.1 },
    { name: 'A03_Rubble_East', prop: 'ruin.rubbleLarge', position: [30.5, 0, -8], scale: 0.9 },
    { name: 'A03_Rubble_South', prop: 'ruin.rubbleHalf', position: [10, 0, 31], rotation: 0.5, scale: 1.2 },
    { name: 'A03_Rubble_West', prop: 'ruin.rubbleHalf', position: [-30.5, 0, 19], rotation: -0.8 },
    { name: 'A03_Burnt_Tree_Northwest', prop: 'nature.highwoodBareB', position: [-17, 0, -28], scale: 0.72 },
    { name: 'A03_Burnt_Tree_East', prop: 'nature.highwoodBareA', position: [30, 0, 1], scale: 0.78 },
    { name: 'A03_Pine_Southwest', prop: 'nature.highwoodPineA', position: [-30, 0, 29], scale: 0.7 },
    ...createWallRun({ prefix: 'A03_CurtainWall_East', prop: 'ruin.curtainA', brokenProp: 'ruin.curtainB', brokenEvery: 2, from: [35.5, -23.8], to: [35.5, 34.72], moduleLength: 14, scale: 1.08 }),
    ...createWallRun({ prefix: 'A03_CurtainWall_South', prop: 'ruin.curtainB', brokenProp: 'ruin.curtainA', brokenEvery: 3, from: [-22.5, 35.5], to: [25, 35.5], moduleLength: 14, scale: 1.08 }),
    { name: 'A03_Corner_SE', prop: 'ruin.cornerTower', position: [35.807, 0, 29.645], rotation: Math.PI / 6, scale: 1.1 },
  ],
  scatters: [
    { prefix: 'A03_Masonry_Debris', props: ['ruin.rubbleHalf', 'ruin.rubbleLarge'], count: 28, bounds: { minX: -30, maxX: 31, minZ: -29, maxZ: 30 }, seed: 301, scale: [0.18, 0.4], exclusions: clearings },
    { prefix: 'A03_Weeds', props: ['nature.grassTuft', 'nature.forestBushA'], count: 36, bounds: { minX: -32, maxX: 32, minZ: -30, maxZ: 32 }, seed: 302, scale: [0.35, 0.65], exclusions: clearings },
  ],
  collision: [],
} as const satisfies AreaWorldLayout;
