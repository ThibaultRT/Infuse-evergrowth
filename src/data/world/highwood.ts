import spec from './highwood.json';
import type { CollisionProxy } from '../../domain/world/WorldCollision';
import type { WorldRoadPlacement } from './WorldLayout';

export const HIGHWOOD_ROADS: readonly WorldRoadPlacement[] = spec.roads.map((road) => ({
  ...road, material: 'trail', points: road.points.map(([x, z]) => [x, z] as const),
}));

// These intentional footprints also constrain Blender's rock geometry.
export const HIGHWOOD_COLLISION: readonly CollisionProxy[] = [
  { kind: 'rectangle', center: [spec.northRidge.center[0], spec.northRidge.center[1]], width: spec.northRidge.width, depth: spec.northRidge.depth },
  ...spec.rockMasses.map(({ center: [x, z], radius }): CollisionProxy => ({ kind: 'circle', center: [x, z], radius })),
];

// Walkable ground matches the simulation floor. Relief is confined to solid rocks.
export function highwoodGroundHeight(): number {
  return spec.ground.height;
}
