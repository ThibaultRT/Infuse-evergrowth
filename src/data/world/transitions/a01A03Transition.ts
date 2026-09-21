import type { TransitionWorldLayout } from '../WorldLayout';
import { RIFT_NORTH_Z, area4RiftCutout } from '../area4';
import { FALLEN_KEEP_CORNER_SCALE, fallenKeepCornerPosition } from '../fallenKeep';

export const A01_A03_TRANSITION = {
  kind: 'transition',
  id: 'transition:A01-A03',
  connectionId: 'area1-area3',
  areaIds: [1, 3],
  name: 'Greenhaven–Fallen Keep West Gate',
  origin: [36, 0, 0],
  visualSize: { width: 12, depth: 84 },
  terrain: 'cobble',
  // The river transitions own the northern 12 m band. These two halves meet at
  // the wall axis so meadow reaches the wall and cobble begins inside the keep.
  terrainRegions: [
    { name: 'A01_A03_Greenhaven_Underlay', center: [-3, 6], size: { width: 6, depth: 72 }, terrain: 'meadow', layer: 'underlay' },
    { name: 'A01_A03_FallenKeep_Underlay', center: [3, 6], size: { width: 6, depth: 72 }, terrain: 'cobble', layer: 'underlay' },
  ],
  terrainCutouts: [area4RiftCutout('A01_A03_South_Rift', [36, 0, 0])],
  axis: 'x',
  crossingCenter: 3.6,
  crossingWidth: 7,
  roads: [
    { name: 'A01_A03_GateRoad', points: [[-6, 3.6], [0, 3.6], [6, 3.6]], width: 6.2, material: 'cobble' },
  ],
  props: [
    // The inner standard-scale modules
    // are tangent to its visible faces at z=-2.28 and z=9.48; the outer modules
    // continue into the asymmetric corners; the south corner now meets the rift.
    { name: 'A03_CurtainWall_West_001', prop: 'ruin.curtainA', position: [0, 0, -24.96], rotation: -Math.PI / 2, scale: 1.08 },
    { name: 'A03_CurtainWall_West_002', prop: 'ruin.curtainA', position: [0, 0, -9.84], rotation: -Math.PI / 2, scale: 1.08 },
    { name: 'A03_CurtainWall_West_003', prop: 'ruin.curtainA', position: [0, 0, 17.04], rotation: -Math.PI / 2, scale: 1.08 },
    { name: 'A03_WestGate', prop: 'ruin.gate', position: [0, 0, 3.6], rotation: Math.PI / 2, scale: 0.84 },
    { name: 'A03_Corner_NW', prop: 'ruin.cornerTower', position: fallenKeepCornerPosition([0, -34.3], 7 * Math.PI / 6), rotation: 7 * Math.PI / 6, scale: FALLEN_KEEP_CORNER_SCALE },
    { name: 'A03_Corner_SW', prop: 'ruin.cornerTower', position: fallenKeepCornerPosition([0, RIFT_NORTH_Z], 5 * Math.PI / 3), rotation: 5 * Math.PI / 3, scale: FALLEN_KEEP_CORNER_SCALE },
  ],
  scatters: [],
  collision: [
    { id: 'A01_A03_LockedGate', kind: 'rectangle', center: [0, 3.6], width: 1.2, depth: 7, activation: { kind: 'connection-locked', connectionId: 'area1-area3' } },
  ],
} as const satisfies TransitionWorldLayout;
