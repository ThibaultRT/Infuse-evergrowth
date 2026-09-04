import type { TransitionWorldLayout } from '../WorldLayout';

export const A01_A03_TRANSITION = {
  kind: 'transition',
  id: 'transition:A01-A03',
  connectionId: 'area1-area3',
  areaIds: [1, 3],
  name: 'Greenhaven–Fallen Keep West Gate',
  origin: [36, 0, 0],
  visualSize: { width: 12, depth: 84 },
  terrain: 'transition-fortress',
  axis: 'x',
  crossingCenter: 3.6,
  crossingWidth: 7,
  roads: [
    { name: 'A01_A03_GateRoad', points: [[-6, 3.6], [0, 3.6], [6, 3.6]], width: 6.2, material: 'cobble' },
  ],
  props: [
    // Keep two standard-scale modules on each side of the gate. The inner modules
    // are tangent to its visible faces at z=-2.28 and z=9.48; the outer modules
    // continue edge-to-edge into the asymmetric corner pieces.
    { name: 'A03_CurtainWall_West_001', prop: 'fortress.wall', position: [0, 1.1, -24.96], rotation: -Math.PI / 2, scale: 1.08 },
    { name: 'A03_CurtainWall_West_002', prop: 'fortress.wall', position: [0, 1.1, -9.84], rotation: -Math.PI / 2, scale: 1.08 },
    { name: 'A03_CurtainWall_West_003', prop: 'fortress.wall', position: [0, 1.1, 17.04], rotation: -Math.PI / 2, scale: 1.08 },
    { name: 'A03_CurtainWall_West_004', prop: 'fortress.wall', position: [0, 1.1, 32.16], rotation: -Math.PI / 2, scale: 1.08 },
    { name: 'A03_WestGate', prop: 'fortress.gate', position: [0, 1.1, 3.6], rotation: Math.PI / 2, scale: 0.84 },
    { name: 'A03_Corner_NW', prop: 'fortress.corner', position: [-0.307, 1.1, -28.445], rotation: 7 * Math.PI / 6, scale: 1.1 },
    { name: 'A03_Corner_SW', prop: 'fortress.corner', position: [3.486, 1.1, 35.807], rotation: 5 * Math.PI / 3, scale: 1.1 },
  ],
  scatters: [],
  collision: [
    { id: 'A01_A03_LockedGate', kind: 'rectangle', center: [0, 3.6], width: 1.2, depth: 7, activation: { kind: 'connection-locked', connectionId: 'area1-area3' } },
  ],
} as const satisfies TransitionWorldLayout;
