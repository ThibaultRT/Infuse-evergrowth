import type { AreaDefinition, WorldConnection } from '../../types';

/** Shared by live boss defeats and saves predating a newly authored connection. */
export function bossUnlockedConnections(areas: readonly AreaDefinition[], connections: readonly WorldConnection[], defeatedBosses: readonly string[]): WorldConnection[] {
  return connections.filter((connection) => {
    const bossId = areas.find((area) => area.id === connection.unlockOnBossOfAreaId)?.bossSpawnId;
    return bossId != null && defeatedBosses.includes(bossId);
  });
}
