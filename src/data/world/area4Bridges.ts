import detail from './area4-bridges.json';
import keep from './fallen-keep.json';
import { AREA4_SPEC, RIFT_BRIDGE_FLOOR, type WorldBlockoutPart } from './area4';
import { FALLEN_KEEP_GATE_COLLISION } from './fallenKeep';
import { walkSurfaceHeight } from '../../domain/world/WorldWalkSurface';
import type { CollisionProxy } from '../../domain/world/WorldCollision';

const bridge = AREA4_SPEC.bridge;
const land = detail.landGate;
const wall = detail.wallGate;
export const AREA4_LAND_GATE_Z = -bridge.deckLength / 2 - bridge.approachLength;
export const AREA4_WALL_GATE_Z = -bridge.deckLength / 2;
const wallHingeX = keep.gate.opening / 2 + wall.hingeOffset;
const wallFloor = (walkSurfaceHeight(RIFT_BRIDGE_FLOOR, 0, AREA4_WALL_GATE_Z + wall.hingeZ + wall.leafThickness / 2) ?? 0) + wall.groundGap;

export const AREA4_LAND_GATE = {
  barrier: { kind: 'rectangle', center: [0, land.hingeZ], width: land.hingeHalfWidth * 2, depth: land.leafThickness } as const,
  floorHeight: land.groundGap,
  leaves: [{ node: 'S2_GateLeft', openAngle: Math.PI / 2 }, { node: 'S2_GateRight', openAngle: -Math.PI / 2 }],
};
export const AREA4_WALL_GATE = {
  barrier: { kind: 'rectangle', center: [0, wall.hingeZ], width: wallHingeX * 2, depth: wall.leafThickness } as const,
  floorHeight: wallFloor,
  leaves: [{ node: 'W2_GateLeft', openAngle: Math.PI / 2 }, { node: 'W2_GateRight', openAngle: -Math.PI / 2 }],
};

// Posts and parked leaves stay outside the clear corridor. Their fixed proxies
// also close the flanks between each hinge and the bridge rail / curtain wall.
export const AREA4_LAND_GATE_COLLISION: readonly CollisionProxy[] = [-1, 1].map((side) => ({
  kind: 'rectangle', center: [side * land.jambHalfWidth, -(land.hingeHalfWidth - land.jambDepth / 2) / 2],
  width: land.jambWidth, depth: land.hingeHalfWidth + land.jambDepth / 2,
}));
export const AREA4_WALL_GATE_COLLISION: readonly CollisionProxy[] = [
  ...FALLEN_KEEP_GATE_COLLISION,
  ...[-1, 1].map((side): CollisionProxy => ({
    kind: 'rectangle', center: [side * wallHingeX, wall.hingeZ - wallHingeX / 2],
    width: wall.leafThickness, depth: wallHingeX,
  })),
];
export const AREA4_LAND_GATE_FALLBACK: readonly WorldBlockoutPart[] = [
  ...[-1, 1].map((side): WorldBlockoutPart => ({ size: [land.jambWidth, land.height, land.jambDepth], position: [side * land.jambHalfWidth, land.height / 2, 0], material: 'stone' })),
  { size: [land.jambHalfWidth * 2, 0.3, land.jambDepth], position: [0, land.height, 0], material: 'iron' },
];
const wing = (keep.gate.width - keep.gate.opening) / 2;
export const AREA4_WALL_GATE_FALLBACK: readonly WorldBlockoutPart[] = [
  ...[-1, 1].map((side): WorldBlockoutPart => ({ size: [wing, keep.gate.height, keep.gate.depth], position: [side * (keep.gate.opening + wing) / 2, keep.gate.height / 2, 0], material: 'stone' })),
  { size: [keep.gate.opening, 0.45, keep.gate.depth], position: [0, wall.archSpringHeight + keep.gate.opening / 2 + 0.2, 0], material: 'stone' },
];
