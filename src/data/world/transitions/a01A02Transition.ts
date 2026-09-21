import type { TransitionWorldLayout } from '../WorldLayout';
import bridge from '../woodland-bridge.json';

const crossingCenter = 10.8;
// This crossing owns world X -42..36; the eastern river crossing starts at 36.
const waterMinX = -42;
const waterMaxX = 36;
const waterWidth = waterMaxX - waterMinX;
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
  terrain: 'meadow',
  terrainRegions: [
    { name: 'A01_A02_Highwood_Underlay', center: [-3, -3], size: { width: 78, depth: 6 }, terrain: 'forest', layer: 'underlay' },
    { name: 'A01_A02_Greenhaven_Underlay', center: [-3, 3], size: { width: 78, depth: 6 }, terrain: 'meadow', layer: 'underlay' },
  ],
  axis: 'z',
  crossingCenter,
  crossingWidth: bridge.pathWidth,
  barrierDepth: 9,
  roads: [],
  surfaces: [
    { name: 'A01_A02_Mosswater', kind: 'water', center: [(waterMinX + waterMaxX) / 2, 0], size: { width: waterWidth, depth: 9 }, elevation: 0.08 },
  ],
  props: [
    { name: 'A01_A02_Bridge', prop: 'crossing.woodlandBridge', position: [crossingCenter, 0, 0] },
  ],
  scatters: [],
  collision: [
    { id: 'A01_A02_Water_West', kind: 'rectangle', center: [(waterMinX + westEdge) / 2, 0], width: westEdge - waterMinX, depth: 9 },
    { id: 'A01_A02_Water_East', kind: 'rectangle', center: [(waterMaxX + eastEdge) / 2, 0], width: waterMaxX - eastEdge, depth: 9 },
  ],
} as const satisfies TransitionWorldLayout;
