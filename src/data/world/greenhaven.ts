import spec from './greenhaven.json';
import type { CollisionProxy } from '../../domain/world/WorldCollision';
import type { WorldRoadPlacement, WorldSurfacePlacement } from './WorldLayout';

export const GREENHAVEN_ROADS: readonly WorldRoadPlacement[] = spec.roads.map((road) => ({
  ...road, material: 'trail', points: road.points.map(([x, z]) => [x, z] as const),
}));

// The landscape's authored footprints are shared with the Blender exporter.
// They describe impassable water and rock masses, never bounds inferred from GLB.
export const GREENHAVEN_COLLISION: readonly CollisionProxy[] = [
  { kind: 'circle', center: [spec.lake.center[0], spec.lake.center[1]], radius: spec.lake.radius },
  ...spec.westRocks.map(({ center: [x, z], radius }): CollisionProxy => ({ kind: 'circle', center: [x, z], radius })),
];

export function greenhavenGroundHeight(x: number, z: number): number {
  const { lake, plateau } = spec;
  const apron = Math.min(1, Math.max(0, plateau.westEdge - x, z - plateau.southEdge) / plateau.cliffLipWidth);
  const shore = Math.min(1, Math.max(0, lake.radius - Math.hypot(x - lake.center[0], z - lake.center[1])) / 0.7);
  return Math.min(apron * plateau.bottomHeight, shore * lake.bedHeight);
}

// Clip the cove where it joins the transition's river: one water surface per point.
const { lake } = spec;
const angle = Math.asin((lake.channelEdgeZ - lake.center[1]) / lake.radius);
export const GREENHAVEN_LAKE: WorldSurfacePlacement = {
  name: 'A01_Lake_Northwest', kind: 'water', center: [lake.center[0], lake.center[1]],
  size: { width: lake.radius * 2, depth: lake.radius * 2 }, elevation: lake.waterHeight,
  outline: Array.from({ length: 65 }, (_, index) => {
    const theta = angle + (Math.PI - 2 * angle) * index / 64;
    return [Math.cos(theta) * lake.radius, Math.sin(theta) * lake.radius] as const;
  }),
};
