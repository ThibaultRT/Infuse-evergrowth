import spec from './fallen-keep.json';
import type { CollisionProxy } from '../../domain/world/WorldCollision';
import type { WorldEncounterSpot, WorldRoadPlacement, WorldSurfacePlacement, WorldTerrainCutout } from './WorldLayout';

type MasonrySegment = { readonly center: readonly number[]; readonly width: number; readonly depth: number; readonly rotation?: number };
const segmentProxy = (segment: MasonrySegment): CollisionProxy => ({
  kind: 'rectangle', center: [segment.center[0], segment.center[1]],
  width: segment.width, depth: segment.depth, rotation: segment.rotation ?? 0,
});

export const FALLEN_KEEP_WALL_COLLISION: readonly CollisionProxy[] = [segmentProxy({ ...spec.wall, center: [0, 0] })];
export const FALLEN_KEEP_CORNER_COLLISION: readonly CollisionProxy[] = [
  ...spec.corner.arms.map(segmentProxy),
  { kind: 'circle', center: [spec.corner.tower.center[0], spec.corner.tower.center[1]], radius: spec.corner.tower.radius },
];
const gateWing = (spec.gate.width - spec.gate.opening) / 2;
export const FALLEN_KEEP_GATE_COLLISION: readonly CollisionProxy[] = [-1, 1].map((side) => segmentProxy({
  center: [side * (spec.gate.opening + gateWing) / 2, 0], width: gateWing, depth: spec.gate.depth,
}));

export function fallenKeepShellCollision(shell: keyof typeof spec.shells): readonly CollisionProxy[] {
  return spec.shells[shell].segments.map(segmentProxy);
}

export const FALLEN_KEEP_ROADS: readonly WorldRoadPlacement[] = spec.roads.map((road) => ({
  ...road, material: 'cobble', points: road.points.map(([x, z]) => [x, z] as const),
}));
const cliff = spec.outerCliff;
const cliffMiddle = (cliff.edge + cliff.outerEdge) / 2;
const apronMiddle = (cliff.from + cliff.outerEdge) / 2;
export const FALLEN_KEEP_CLIFF_CUTOUTS: readonly WorldTerrainCutout[] = [
  { name: 'A03_Outer_East_Cliff', center: [cliffMiddle, apronMiddle], size: { width: cliff.outerEdge - cliff.edge, depth: cliff.outerEdge - cliff.from }, elevation: cliff.base },
  { name: 'A03_Outer_South_Cliff', center: [apronMiddle, cliffMiddle], size: { width: cliff.outerEdge - cliff.from, depth: cliff.outerEdge - cliff.edge }, elevation: cliff.base },
];
export const FALLEN_KEEP_ENCOUNTER_SPOTS: readonly WorldEncounterSpot[] = spec.encounterSpots.map((spot) => ({
  ...spot, center: [spot.center[0], spot.center[1]],
}));

/** Uniform corner placement whose ruined tower pivot sits on both adjoining wall axes. */
export const FALLEN_KEEP_CORNER_SCALE = 1.1;
export function fallenKeepCornerPosition(intersection: readonly [number, number], rotation: number): readonly [number, number, number] {
  const [towerX, towerZ] = spec.corner.tower.center;
  const cosine = Math.cos(rotation), sine = Math.sin(rotation);
  const offsetX = (towerX * cosine + towerZ * sine) * FALLEN_KEEP_CORNER_SCALE;
  const offsetZ = (-towerX * sine + towerZ * cosine) * FALLEN_KEEP_CORNER_SCALE;
  return [intersection[0] - offsetX, 0, intersection[1] - offsetZ];
}

const horizon = spec.outerCliff.horizon;
/** Cosmetic floor below the eastern cliff; its remote edges disappear inside world fog. */
export const FALLEN_KEEP_EAST_HORIZON: WorldSurfacePlacement = {
  name: 'A03_East_Cliff_Horizon',
  kind: 'cliff',
  center: [(cliff.outerEdge + horizon.east) / 2, (horizon.north + horizon.south) / 2],
  size: { width: horizon.east - cliff.outerEdge, depth: horizon.south - horizon.north },
  elevation: cliff.base - 0.02,
};

export function fallenKeepGroundHeight(): number {
  return spec.groundHeight;
}
