import { createWallRun, type TransitionWorldLayout } from '../WorldLayout';
import { FALLEN_KEEP_CORNER_SCALE, fallenKeepCornerPosition } from '../fallenKeep';

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
    // The gate's visible outer faces are x=1.32 and x=13.08 at scale 0.84.
    ...createWallRun({ prefix: 'A03_CurtainWall_North', prop: 'ruin.curtainA', from: [-25.8, 1.7], to: [1.32, 1.7], moduleLength: 14, elevation: 0, scale: 1.08, alignment: 'end', startIndex: 1, rotationOffset: Math.PI }),
    ...createWallRun({ prefix: 'A03_CurtainWall_North', prop: 'ruin.curtainA', from: [13.08, 1.7], to: [19.6, 1.7], moduleLength: 14, elevation: 0, scale: 1.08, alignment: 'start', startIndex: 3, rotationOffset: Math.PI }),
    { name: 'A02_A03_Bridge', prop: 'crossing.bridgeA', position: [7.2, 0.15, -1.5], scale: 0.76, collision: 'none' },
    { name: 'A03_NorthGate', prop: 'ruin.gate', position: [7.2, 0, 1.7], scale: 0.84 },
    { name: 'A03_Corner_NE', prop: 'ruin.cornerTower', position: fallenKeepCornerPosition([35.5, 1.7], 2 * Math.PI / 3), rotation: 2 * Math.PI / 3, scale: FALLEN_KEEP_CORNER_SCALE },
  ],
  scatters: [],
  collision: [
    { id: 'A02_A03_Water_West', kind: 'rectangle', center: [-19.15, -1.5], width: 45.7, depth: 7.5 },
    { id: 'A02_A03_Water_East', kind: 'rectangle', center: [26.35, -1.5], width: 31.3, depth: 7.5 },
    { id: 'A02_A03_LockedGate', kind: 'rectangle', center: [7.2, 1.7], width: 7, depth: 1.2, activation: { kind: 'connection-locked', connectionId: 'area2-area3' } },
  ],
} as const satisfies TransitionWorldLayout;
