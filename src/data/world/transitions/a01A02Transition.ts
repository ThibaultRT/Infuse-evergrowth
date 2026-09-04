import type { TransitionWorldLayout } from '../WorldLayout';

export const A01_A02_TRANSITION = {
  kind: 'transition',
  id: 'transition:A01-A02',
  connectionId: 'area1-area2',
  areaIds: [1, 2],
  name: 'Greenhaven–Highwood Mosswater Gate',
  origin: [0, 0, -36],
  visualSize: { width: 84, depth: 12 },
  terrain: 'transition-meadow',
  axis: 'z',
  crossingCenter: 10.8,
  crossingWidth: 7,
  barrierDepth: 9,
  roads: [
    { name: 'A01_A02_Causeway', points: [[10.8, 6], [10.8, 0], [10.8, -6]], width: 6.4, material: 'cobble' },
  ],
  surfaces: [
    { name: 'A01_A02_Mosswater', kind: 'water', center: [0, 0], size: { width: 84, depth: 9 }, elevation: 0.08 },
  ],
  props: [
    { name: 'A01_A02_Bridge', prop: 'crossing.bridgeB', position: [10.8, 0.15, 0], scale: 0.76, collision: 'none' },
    { name: 'A01_A02_Gate', prop: 'fortress.gate', position: [10.8, 0.15, -1.6], scale: 0.78 },
    { name: 'A01_A02_Tower_West', prop: 'village.towerBlueA', position: [4.8, 0.1, 2.6], rotation: 0.1, scale: 0.9 },
    { name: 'A01_A02_Tower_East', prop: 'village.towerBlueB', position: [16.8, 0.1, 2.6], rotation: -0.1, scale: 0.9 },
  ],
  scatters: [],
  collision: [
    { id: 'A01_A02_Water_West', kind: 'rectangle', center: [-17.35, 0], width: 49.3, depth: 9 },
    { id: 'A01_A02_Water_East', kind: 'rectangle', center: [28.15, 0], width: 27.7, depth: 9 },
    { id: 'A01_A02_LockedGate', kind: 'rectangle', center: [10.8, -1.6], width: 7, depth: 1.2, activation: { kind: 'connection-locked', connectionId: 'area1-area2' } },
  ],
} as const satisfies TransitionWorldLayout;
