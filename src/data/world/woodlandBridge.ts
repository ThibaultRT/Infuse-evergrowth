import spec from './woodland-bridge.json';
import type { CollisionProxy } from '../../domain/world/WorldCollision';
import type { WorldWalkSurface } from '../../domain/world/WorldWalkSurface';

const sourceScale = spec.deckLength / (spec.sourceDeckMax - spec.sourceDeckMin);
const sourceCenter = (spec.sourceDeckMin + spec.sourceDeckMax) / 2;
const halfLength = spec.deckLength / 2;
export const WOODLAND_BRIDGE_GATE_Z = -(spec.sourceHinge[1] - sourceCenter) * sourceScale;
export const WOODLAND_BRIDGE_WALK_SURFACE = {
  width: spec.pathWidth,
  profile: [[-halfLength - spec.approachLength, 0], [-halfLength, spec.deckHeight], [halfLength, spec.deckHeight], [halfLength + spec.approachLength, 0]],
} as const satisfies WorldWalkSurface;

export const WOODLAND_BRIDGE_COLLISION: readonly CollisionProxy[] = [
  // The logs and approach edges keep actors on the deck. The doorway also
  // reserves clearance for the leaves when folded inward against the railing.
  ...[-1, 1].map((side): CollisionProxy => ({ kind: 'rectangle', center: [side * (spec.pathWidth / 2 + 0.3), 0], width: 0.6, depth: spec.deckLength + spec.approachLength * 2 })),
  ...[-1, 1].map((side): CollisionProxy => ({ kind: 'rectangle', center: [side * 1.9, WOODLAND_BRIDGE_GATE_Z - 0.7], width: 0.6, depth: 2.5 })),
];

export const WOODLAND_BRIDGE_GATE = {
  barrier: { kind: 'rectangle', center: [0, WOODLAND_BRIDGE_GATE_Z], width: 3.2, depth: 0.3 } as const satisfies CollisionProxy,
  leaves: [
    { node: 'WoodlandBridge_GateLeft', openAngle: Math.PI / 2 },
    { node: 'WoodlandBridge_GateRight', openAngle: -Math.PI / 2 },
  ],
};
