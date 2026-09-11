import type { TransitionWorldLayout } from '../WorldLayout';
import bridge from '../woodland-bridge.json';

const crossingCenter = 10.8;
const waterWidth = 84;
const westEdge = crossingCenter - bridge.pathWidth / 2;
const eastEdge = crossingCenter + bridge.pathWidth / 2;

export const A01_A02_TRANSITION = {
  kind: 'transition',
  id: 'transition:A01-A02',
  connectionId: 'area1-area2',
  areaIds: [1, 2],
  name: 'Greenhaven–Highwood Woodland Bridge',
  origin: [0, 0, -36],
  visualSize: { width: 84, depth: 12 },
  terrain: 'transition-meadow',
  axis: 'z',
  crossingCenter,
  crossingWidth: bridge.pathWidth,
  barrierDepth: 9,
  roads: [],
  surfaces: [
    { name: 'A01_A02_Mosswater', kind: 'water', center: [0, 0], size: { width: 84, depth: 9 }, elevation: 0.08 },
  ],
  props: [
    { name: 'A01_A02_Bridge', prop: 'crossing.woodlandBridge', position: [crossingCenter, 0, 0] },
  ],
  scatters: [],
  collision: [
    { id: 'A01_A02_Water_West', kind: 'rectangle', center: [(-waterWidth / 2 + westEdge) / 2, 0], width: westEdge + waterWidth / 2, depth: 9 },
    { id: 'A01_A02_Water_East', kind: 'rectangle', center: [(waterWidth / 2 + eastEdge) / 2, 0], width: waterWidth / 2 - eastEdge, depth: 9 },
  ],
} as const satisfies TransitionWorldLayout;
