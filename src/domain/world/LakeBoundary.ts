import type { AreaDefinition, WorldConnection } from '../../types';

export type LakeBarrierSegment = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const LAKE_VISUAL_MARGIN = 13;

/**
 * Keep the authored lake limited to the shared horizontal frontage of its two
 * areas, with enough scenery-only overhang that its ends stay outside normal
 * play. Using this same extent for rendering and collision prevents invisible
 * water from covering a different connection farther along the world seam.
 */
export function lakeBarrierBounds(connection: WorldConnection, areas: readonly AreaDefinition[]): { minX: number; maxX: number } {
  const areaA = areas.find((area) => area.id === connection.areaAId);
  const areaB = areas.find((area) => area.id === connection.areaBId);
  if (!areaA || !areaB) throw new Error(`Unknown lake connection areas for ${connection.id}`);
  const sharedMinX = Math.max(areaA.originX - areaA.size.width / 2, areaB.originX - areaB.size.width / 2);
  const sharedMaxX = Math.min(areaA.originX + areaA.size.width / 2, areaB.originX + areaB.size.width / 2);
  return { minX: sharedMinX - LAKE_VISUAL_MARGIN, maxX: sharedMaxX + LAKE_VISUAL_MARGIN };
}

/**
 * Split a horizontal water frontier into two solid lakes separated by the
 * authored gate opening. Callers provide shared bounds so the water surface
 * and its collision end at the same safely out-of-play coordinates.
 */
export function lakeBarrierSegments(connection: WorldConnection, worldMinX: number, worldMaxX: number): [LakeBarrierSegment, LakeBarrierSegment] {
  const halfOpening = connection.width / 2;
  const halfDepth = (connection.barrierDepth ?? 0) / 2;
  return [
    { minX: worldMinX, maxX: connection.x - halfOpening, minZ: connection.z - halfDepth, maxZ: connection.z + halfDepth },
    { minX: connection.x + halfOpening, maxX: worldMaxX, minZ: connection.z - halfDepth, maxZ: connection.z + halfDepth }
  ];
}
