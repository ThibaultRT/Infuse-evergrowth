import type { WorldConnection } from '../../types';

export type LakeBarrierSegment = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/**
 * Split a horizontal water frontier into two solid lakes separated by the
 * authored gate opening. The bounds extend past the world edges so neither
 * the water nor its collision can end inside the visible play space.
 */
export function lakeBarrierSegments(connection: WorldConnection, worldMinX: number, worldMaxX: number): [LakeBarrierSegment, LakeBarrierSegment] {
  const halfOpening = connection.width / 2;
  const halfDepth = (connection.barrierDepth ?? 0) / 2;
  return [
    { minX: worldMinX, maxX: connection.x - halfOpening, minZ: connection.z - halfDepth, maxZ: connection.z + halfDepth },
    { minX: connection.x + halfOpening, maxX: worldMaxX, minZ: connection.z - halfDepth, maxZ: connection.z + halfDepth }
  ];
}
