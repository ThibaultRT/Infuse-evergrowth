import spec from './area4-boundaries.json';
import { AREA4_ORIGIN, AREA4_SPEC, RIFT_SOUTH_Z, type WorldBlockoutPart } from './area4';
import { createWallRun, type WorldPropPlacement } from './WorldLayout';

export const AREA4_BOUNDARY_SPEC = spec;
const eastX = AREA4_SPEC.playableSize.width / 2;
const northZ = RIFT_SOUTH_Z - AREA4_ORIGIN[2];
const southZ = AREA4_SPEC.playableSize.depth / 2;
const gateZ = northZ + (southZ - northZ) * spec.gate.fractionDownWall;

/** A scenic edge belongs to A04; it does not invent a connection to an absent area. */
export const AREA4_SOUTH_LAVA_PLACEMENT: WorldPropPlacement = {
  name: 'A04_South_Lava_Transition', prop: 'terrain.area4LavaLake',
  position: [0, 0, AREA4_SPEC.visualSize.depth / 2 - spec.southLake.depth / 2],
};
export const AREA4_SOUTH_GROUND_Z = AREA4_SOUTH_LAVA_PLACEMENT.position[2] - spec.southLake.depth / 2;
export const AREA4_EAST_GATE_PLACEMENT: WorldPropPlacement = {
  name: 'A04_East_Gate', prop: 'boundary.area4Gate', position: [eastX, 0, gateZ], rotation: Math.PI / 2,
};
const northWall = createWallRun({
  prefix: 'A04_East_Fence', prop: 'boundary.area4Fence', from: [eastX, northZ], to: [eastX, gateZ - spec.gate.width / 2],
  moduleLength: spec.fence.width, alignment: 'end',
});
export const AREA4_BOUNDARY_PLACEMENTS: readonly WorldPropPlacement[] = [
  ...northWall,
  AREA4_EAST_GATE_PLACEMENT,
  ...createWallRun({
    prefix: 'A04_East_Fence', prop: 'boundary.area4Fence', from: [eastX, gateZ + spec.gate.width / 2], to: [eastX, AREA4_SOUTH_GROUND_Z],
    moduleLength: spec.fence.width, alignment: 'start', startIndex: northWall.length + 1,
  }),
  AREA4_SOUTH_LAVA_PLACEMENT,
];

export const AREA4_FENCE_FALLBACK: readonly WorldBlockoutPart[] = [
  { size: [spec.fence.width, spec.fence.height, spec.fence.depth], position: [0, spec.fence.height / 2, 0], material: 'timber' },
];
export const AREA4_GATE_FALLBACK: readonly WorldBlockoutPart[] = [
  ...[-1, 1].map((side): WorldBlockoutPart => ({ size: [1.5, spec.gate.height, spec.gate.depth], position: [side * (spec.gate.width - 1.5) / 2, spec.gate.height / 2, 0], material: 'stone' })),
  { size: [spec.gate.width - 3, 3, 0.4], position: [0, 1.5, 0], material: 'iron' },
];
