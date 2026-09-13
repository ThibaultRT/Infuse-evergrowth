import spec from './area4-blockout.json';
import type { CollisionProxy } from '../../domain/world/WorldCollision';
import type { WorldWalkSurface } from '../../domain/world/WorldWalkSurface';
import type { WorldVec3 } from '../../domain/world/WorldPlacement';
import type { WorldTerrainCutout } from './WorldLayout';

export type BlockoutMaterial = 'ash' | 'stone' | 'iron' | 'timber' | 'lava';
export type WorldBlockoutPart = {
  readonly size: WorldVec3;
  readonly position: WorldVec3;
  readonly material: BlockoutMaterial;
  readonly kind?: 'box' | 'cylinder';
  readonly rotation?: number;
};

export const AREA4_SPEC = spec;
export const AREA4_ORIGIN: WorldVec3 = [spec.origin[0], spec.origin[1], spec.origin[2]];
export const RIFT_NORTH_Z = spec.rift.seamZ - spec.rift.depth / 2;
export const RIFT_SOUTH_Z = spec.rift.seamZ + spec.rift.depth / 2;

/** All overlapping area/apron terrain yields to the same seam-centered rift. */
export function area4RiftCutout(name: string, origin: WorldVec3): WorldTerrainCutout {
  return {
    name, center: [AREA4_ORIGIN[0] - origin[0], spec.rift.seamZ - origin[2]],
    size: { width: spec.rift.halfWidth * 2, depth: spec.rift.depth }, elevation: spec.rift.floorY - 0.1,
  };
}

const bridge = spec.bridge;
const halfDeck = bridge.deckLength / 2;
const halfLength = halfDeck + bridge.approachLength;

export const RIFT_BRIDGE_FLOOR: WorldWalkSurface = {
  width: bridge.width,
  profile: [[-halfLength, 0], [-halfDeck, bridge.deckHeight], [halfDeck, bridge.deckHeight], [halfLength, 0]],
};
export const RIFT_BRIDGE_COLLISION: readonly CollisionProxy[] = [-1, 1].map((side) => ({
  kind: 'rectangle', center: [side * (bridge.width + bridge.railThickness) / 2, 0],
  width: bridge.railThickness, depth: halfLength * 2,
}));
export const RIFT_BRIDGE_GATE = {
  barrier: { kind: 'rectangle', center: [0, -halfDeck], width: bridge.width, depth: 0.3 } as const,
  leaves: [],
};

/** Only silhouette guides. Both decks project the same authored floor profile. */
export function riftBridgeBlockout(material: 'iron' | 'timber'): readonly WorldBlockoutPart[] {
  const parts: WorldBlockoutPart[] = [];
  for (const side of [-1, 1]) {
    const x = side * (bridge.width + bridge.railThickness) / 2;
    for (const z of [-halfDeck, 0, halfDeck]) {
      parts.push({ size: [0.22, material === 'iron' ? 2.4 : 1.5, 0.22], position: [x, 1.2, z], material });
    }
    if (material === 'iron') {
      parts.push({ size: [bridge.railThickness, 0.22, bridge.deckLength], position: [x, 1.8, 0], material });
    } else {
      // Broken-looking side timbers never remove the central walkable deck.
      for (const z of [-4, 4]) parts.push({ size: [0.18, 0.18, 3], position: [x, 1.25, z], material, rotation: side * 0.12 });
      parts.push({ size: [0.22, 2, 0.22], position: [x, -0.65, 1.8], material });
    }
  }
  return parts;
}

const throne = spec.throne;
export const THRONE_BLOCKOUT: readonly WorldBlockoutPart[] = [
  { size: [throne.width, 0.35, throne.depth], position: [0, 0.175, 0], material: 'stone' },
  { size: [throne.width - 0.5, 1.5, throne.depth - 0.6], position: [0, 1.1, 0], material: 'stone' },
  { size: [throne.width - 0.4, throne.height - 0.35, 0.55], position: [0, (throne.height + 0.35) / 2, (throne.depth - 0.55) / 2], material: 'stone' },
  ...[-1, 1].map((side): WorldBlockoutPart => ({ size: [0.5, 0.7, 2.6], position: [side * (throne.width - 0.5) / 2, 2.2, -0.2], material: 'stone' })),
];
export const THRONE_COLLISION: readonly CollisionProxy[] = [{ kind: 'rectangle', center: [0, 0], width: throne.width, depth: throne.depth }];
