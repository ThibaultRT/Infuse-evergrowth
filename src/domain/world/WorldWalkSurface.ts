import type { WorldTransform, WorldVec2 } from './WorldPlacement';

/** An intentional, continuous floor profile along a prop's local Z axis. */
export type WorldWalkSurface = {
  readonly width: number;
  /** Ordered [local Z, local floor Y] points, including both landings. */
  readonly profile: readonly WorldVec2[];
};

export type PlacedWorldWalkSurface = WorldWalkSurface & { readonly transform: WorldTransform };

export function walkSurfaceHeight(surface: WorldWalkSurface, x: number, z: number): number | undefined {
  if (Math.abs(x) > surface.width / 2) return undefined;
  for (let index = 1; index < surface.profile.length; index += 1) {
    const [startZ, startY] = surface.profile[index - 1];
    const [endZ, endY] = surface.profile[index];
    if (z < startZ || z > endZ) continue;
    return startY + (endY - startY) * (z - startZ) / (endZ - startZ);
  }
  return undefined;
}

export function worldWalkHeight(surfaces: readonly PlacedWorldWalkSurface[], position: Readonly<{ x: number; z: number }>): number {
  let height = 0;
  for (const surface of surfaces) {
    const { transform } = surface;
    const scale = transform.scale ?? 1;
    const angle = transform.rotation ?? 0;
    const dx = (position.x - transform.position[0]) / scale;
    const dz = (position.z - transform.position[2]) / scale;
    const localHeight = walkSurfaceHeight(surface, dx * Math.cos(angle) - dz * Math.sin(angle), dx * Math.sin(angle) + dz * Math.cos(angle));
    if (localHeight !== undefined) height = Math.max(height, transform.position[1] + localHeight * scale);
  }
  return height;
}
