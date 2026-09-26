import type { AreaWorldLayout, WorldPropPlacement, WorldScatterPlacement } from '../WorldLayout';
import { A01_A02_TRANSITION } from '../transitions/a01A02Transition';
import { clearTransitionApproaches, transitionTerrainCutouts } from '../transitionTerrainCutouts';
import { GREENHAVEN_LAKE, GREENHAVEN_ROADS } from '../greenhaven';
import { greenhavenClearings, greenhavenTreeGrass } from '../greenhavenDressing';
import { A01_A04_TRANSITION } from '../transitions/area4RiftTransition';
import { RIFT_NORTH_Z, area4RiftCutout } from '../area4';

const origin = [0, 0, 0] as const;
const pines = ['nature.greenhavenPineA', 'nature.greenhavenPineB'] as const;
const props = [
  { name: 'A01_Landscape', prop: 'terrain.greenhaven', position: [0, 0, 0] },
  { name: 'A01_Fountain_Central', prop: 'landmark.fountain', position: [0, 0, 4.5], rotation: 0.25 },
  { name: 'A01_House_West', prop: 'village.warmHomeA', position: [-18, 0, -15], rotation: 2.7, scale: 1.1 },
  { name: 'A01_Tavern_North', prop: 'village.warmHomeB', position: [20, 0, -10.5], rotation: -2.1, scale: 1.18 },
  { name: 'A01_House_Southwest', prop: 'village.homeBlueB', position: [-18, 0, 8], rotation: 0.55, scale: 1.08 },
  { name: 'A01_House_South', prop: 'village.homeBlueA', position: [-17, 0, 25.5], rotation: 0.2, scale: 1.15 },
  { name: 'A01_Blacksmith_East', prop: 'village.blacksmithBlue', position: [22, 0, 16], rotation: -1.3, scale: 0.94 },
  { name: 'A01_Market_East', prop: 'village.marketBlue', position: [23, 0, 24], rotation: -2.6, scale: 0.8 },
  { name: 'A01_Well_West', prop: 'village.wellBlue', position: [-9, 0, 6], scale: 0.7 },
  { name: 'A01_Garden_Fence_N', prop: 'village.rusticFence', position: [13, 0, 11.3], scale: 0.94 },
  { name: 'A01_Garden_Fence_E', prop: 'village.rusticFence', position: [16, 0, 14], rotation: Math.PI / 2, scale: 0.8 },
  { name: 'A01_Garden_Fence_S', prop: 'village.rusticFenceGate', position: [13, 0, 16.7], scale: 0.94 },
  { name: 'A01_Garden_Fence_W', prop: 'village.rusticFence', position: [10, 0, 14], rotation: Math.PI / 2, scale: 0.8 },
  { name: 'A01_Cottage_Fence_W', prop: 'village.rusticFence', position: [-24, 0, 4.8], rotation: Math.PI / 2, scale: 0.75 },
  { name: 'A01_Cottage_Fence_N', prop: 'village.rusticFence', position: [-21, 0, 2.7], scale: 0.8 },
  { name: 'A01_Inn_Fence_W', prop: 'village.rusticFence', position: [-22, 0, -14], rotation: 1.2, scale: 0.75 },
  { name: 'A01_Inn_Fence_S', prop: 'village.rusticFenceGate', position: [-18.5, 0, -10.7], rotation: -0.2, scale: 0.8 },
  { name: 'A01_Cart', prop: 'prop.wheelbarrow', position: [-9, 0, 9], rotation: -0.7, scale: 0.75 },
  { name: 'A01_Lumber', prop: 'prop.lumber', position: [25.5, 0, 16.7], rotation: 0.6, scale: 0.7 },
  { name: 'A01_Crates_01', prop: 'prop.crate', position: [19, 0, 22], rotation: 0.2, scale: 0.65 },
  { name: 'A01_Crates_02', prop: 'prop.crateOpen', position: [19.8, 0, 23.2], rotation: -0.5, scale: 0.65 },
  { name: 'A01_Inn_Barrel', prop: 'prop.barrel', position: [-14.8, 0, -13], scale: 0.7 },
  { name: 'A01_Smith_Barrel', prop: 'prop.barrel', position: [17.2, 0, -8], scale: 0.7 },
  { name: 'A01_Smith_Stone', prop: 'prop.stonePile', position: [24, 0, -9], scale: 0.65 },
  { name: 'A01_FutureGate_West', prop: 'fortress.gate', position: [-38.5, 0, -5.4], rotation: Math.PI / 2, scale: 0.72, collision: 'none' },
  { name: 'A01_Woodpile_West', prop: 'prop.lumber', position: [-23, 0, 9.5], rotation: 0.4, scale: 0.75 },
  { name: 'A01_Market_Barrel', prop: 'prop.barrel', position: [25.5, 0, 23], scale: 0.7 },
  { name: 'A01_Cottage_Crate', prop: 'prop.crate', position: [-20, 0, 22.5], rotation: 0.2, scale: 0.65 },
  { name: 'A01_FallenLog_North', prop: 'nature.greenhavenLog', position: [-6, 0, -24], rotation: 0.35 },
  { name: 'A01_Stump_North', prop: 'nature.greenhavenStump', position: [-8.3, 0, -23], scale: 1.1 },
  { name: 'A01_FallenLog_East', prop: 'nature.greenhavenLog', position: [30.5, 0, -13], rotation: 1.1, scale: 0.85 },
  { name: 'A01_Stump_West', prop: 'nature.greenhavenStump', position: [-31, 0, 12] },
] as const satisfies readonly WorldPropPlacement[];

const decorate = (scatter: WorldScatterPlacement): WorldScatterPlacement => ({
  ...scatter, bounds: { ...scatter.bounds, maxZ: Math.min(scatter.bounds.maxZ, RIFT_NORTH_Z - (scatter.prefix.startsWith('A01_Tree') ? 2 : 1)) },
  exclusions: [...greenhavenClearings(props, scatter.prefix.startsWith('A01_Tree') ? 2 : 0.8), ...scatter.exclusions ?? []],
});

const scatters = clearTransitionApproaches(clearTransitionApproaches([
  decorate({ prefix: 'A01_Tree_West', props: pines, count: 42, minSpacing: 1.8, bounds: { minX: -32, maxX: -26, minZ: -19, maxZ: RIFT_NORTH_Z - 2 }, seed: 101, scale: [1, 1.55] }),
  decorate({ prefix: 'A01_Tree_North', props: pines, count: 50, minSpacing: 2.0, bounds: { minX: -15, maxX: 32, minZ: -30, maxZ: -21 }, seed: 102, scale: [1.05, 1.65] }),
  decorate({ prefix: 'A01_Tree_South', props: pines, count: 26, minSpacing: 2.1, bounds: { minX: -31, maxX: 32, minZ: RIFT_NORTH_Z - 5, maxZ: RIFT_NORTH_Z - 1 }, seed: 103, scale: [0.8, 1.2] }),
  decorate({ prefix: 'A01_Tree_East', props: pines, count: 32, minSpacing: 2.0, bounds: { minX: 27, maxX: 33, minZ: -23, maxZ: 26 }, seed: 108, scale: [0.9, 1.45] }),
  decorate({ prefix: 'A01_Tree_Landmark', props: pines, count: 40, minSpacing: 2.7, bounds: { minX: -25, maxX: 26, minZ: -22, maxZ: 30 }, seed: 107, scale: [0.8, 1.15], exclusions: [{ center: [13, 14], radius: 6 }, { center: [20, -10.5], radius: 5 }, { center: [22, 20], radius: 7 }] }),
  decorate({ prefix: 'A01_Bush', props: ['nature.greenhavenShrubA', 'nature.greenhavenShrubB', 'nature.greenhavenShrubB'], count: 210, minSpacing: 1.15, bounds: { minX: -29, maxX: 30, minZ: -25, maxZ: 31 }, seed: 104, scale: [0.6, 1.1] }),
  decorate({ prefix: 'A01_Flower', props: ['nature.flowerGroup', 'nature.grassTuft'], count: 85, minSpacing: 1.5, bounds: { minX: -29, maxX: 30, minZ: -25, maxZ: 33 }, seed: 105, scale: [0.55, 1.1] }),
  decorate({ prefix: 'A01_Mushroom', props: ['nature.greenhavenMushrooms'], count: 52, minSpacing: 1.8, bounds: { minX: -31, maxX: 32, minZ: -27, maxZ: 28 }, seed: 110, scale: [0.7, 1.2] }),
  decorate({ prefix: 'A01_Rock', props: ['nature.greenhavenBoulder'], count: 34, bounds: { minX: -31, maxX: 32, minZ: -28, maxZ: 33 }, seed: 106, scale: [0.65, 1.2] }),
], A01_A02_TRANSITION, origin), A01_A04_TRANSITION, origin);

export const AREA_A01_LAYOUT = {
  kind: 'area',
  id: 'area:A01',
  areaId: 1,
  name: 'Greenhaven — The Hearthland',
  origin,
  playableSize: { width: 72, depth: 72 },
  visualSize: { width: 84, depth: 84 },
  terrain: 'meadow',
  // Keep the outer west/south apron, but stop primary ground at the north and
  // east playable seams. Transition underlays cover unloaded neighbours.
  terrainRegions: [{ name: 'A01_Meadow_Ground', center: [-3, 3], size: { width: 78, depth: 78 } }],
  terrainCutouts: [...transitionTerrainCutouts(A01_A02_TRANSITION, origin), area4RiftCutout('A01_South_Rift', origin)],
  roads: GREENHAVEN_ROADS,
  surfaces: [GREENHAVEN_LAKE],
  props: [...props, ...greenhavenTreeGrass(scatters)],
  scatters,
  collision: [],
} as const satisfies AreaWorldLayout;
