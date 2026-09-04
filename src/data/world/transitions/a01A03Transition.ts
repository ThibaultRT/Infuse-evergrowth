import { createWallRun, type TransitionWorldLayout } from '../WorldLayout';

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
    // At these render scales, wall and gate half-lengths are 7.56 m and 5.88 m;
    // the adjacent overrides make their visible ends tangent instead of overlapping.
    ...createWallRun({ prefix: 'A03_CurtainWall_West', prop: 'fortress.wall', brokenProp: 'fortress.wallBroken', brokenEvery: 4, from: [0, -35.5], to: [0, 35.5], spacing: 6.4, elevation: 1.1, scale: 1.08, rotationOffset: -Math.PI, omitIndices: [1, 2, 6, 8, 11, 12], positionOverrides: { 5: [0, -9.84], 9: [0, 17.04] }, gaps: [{ center: [0, 3.6], radius: 4.2 }] }),
    { name: 'A03_WestGate', prop: 'fortress.gate', position: [0, 1.1, 3.6], rotation: Math.PI / 2, scale: 0.84 },
    { name: 'A03_Corner_NW', prop: 'fortress.corner', position: [-0.307, 1.1, -28.445], rotation: 7 * Math.PI / 6, scale: 1.1 },
    { name: 'A03_Corner_SW', prop: 'fortress.corner', position: [5.855, 1.1, 35.807], rotation: 5 * Math.PI / 3, scale: 1.1 },
  ],
  scatters: [],
  collision: [
    { id: 'A01_A03_LockedGate', kind: 'rectangle', center: [0, 3.6], width: 1.2, depth: 7, activation: { kind: 'connection-locked', connectionId: 'area1-area3' } },
  ],
} as const satisfies TransitionWorldLayout;
