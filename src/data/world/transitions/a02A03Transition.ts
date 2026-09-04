import { createWallRun, type TransitionWorldLayout } from '../WorldLayout';

export const A02_A03_TRANSITION = {
  kind: 'transition',
  id: 'transition:A02-A03',
  connectionId: 'area2-area3',
  areaIds: [2, 3],
  name: 'Highwood–Fallen Keep Fortified River Crossing',
  origin: [72, 0, -36],
  visualSize: { width: 84, depth: 12 },
  terrain: 'transition-fortress',
  axis: 'z',
  crossingCenter: 7.2,
  crossingWidth: 7,
  barrierDepth: 9,
  roads: [
    { name: 'A02_A03_BridgeRoad', points: [[7.2, -6], [7.2, 0], [7.2, 6]], width: 6.2, material: 'cobble' },
  ],
  surfaces: [
    { name: 'A02_A03_Mosswater', kind: 'water', center: [0, -1.5], size: { width: 84, depth: 7.5 }, elevation: 0.08 },
  ],
  props: [
    ...createWallRun({ prefix: 'A03_CurtainWall_North', prop: 'fortress.wall', brokenProp: 'fortress.wallBroken', brokenEvery: 5, from: [-35.5, 1.7], to: [35.5, 1.7], spacing: 6.4, elevation: 1.1, scale: 1.08, gaps: [{ center: [7.2, 1.7], radius: 4.2 }] }),
    { name: 'A02_A03_Bridge', prop: 'crossing.bridgeA', position: [7.2, 0.15, -1.5], scale: 0.76, collision: 'none' },
    { name: 'A03_NorthGate', prop: 'fortress.gate', position: [7.2, 1.1, 1.7], scale: 0.84 },
    { name: 'A03_Corner_NE', prop: 'fortress.corner', position: [35.5, 1.1, 1.7], scale: 1.1 },
  ],
  scatters: [],
  collision: [
    { id: 'A02_A03_Water_West', kind: 'rectangle', center: [-19.15, -1.5], width: 45.7, depth: 7.5 },
    { id: 'A02_A03_Water_East', kind: 'rectangle', center: [26.35, -1.5], width: 31.3, depth: 7.5 },
    { id: 'A02_A03_LockedGate', kind: 'rectangle', center: [7.2, 1.7], width: 7, depth: 1.2, activation: { kind: 'connection-locked', connectionId: 'area2-area3' } },
  ],
} as const satisfies TransitionWorldLayout;
