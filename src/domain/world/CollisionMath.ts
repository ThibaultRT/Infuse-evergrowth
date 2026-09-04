import type { Position } from './Position';
import type { WorldCollisionShape } from './WorldCollision';

export function circleOverlapsWorldCollision(position: Pick<Position, 'x' | 'z'>, radius: number, shape: WorldCollisionShape): boolean {
  const dx = position.x - shape.x;
  const dz = position.z - shape.z;
  if (shape.kind === 'circle') return dx * dx + dz * dz < (radius + shape.radius) ** 2;
  const cosine = Math.cos(shape.rotation);
  const sine = Math.sin(shape.rotation);
  const localX = dx * cosine - dz * sine;
  const localZ = dx * sine + dz * cosine;
  const closestX = Math.max(-shape.width / 2, Math.min(shape.width / 2, localX));
  const closestZ = Math.max(-shape.depth / 2, Math.min(shape.depth / 2, localZ));
  return (localX - closestX) ** 2 + (localZ - closestZ) ** 2 < radius ** 2;
}
