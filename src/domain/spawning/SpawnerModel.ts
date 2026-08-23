import type { SavedSpawnState, SpawnDefinition, SpawnRoll, TierConfig } from '../../types';

export type SpawnerDefinition = SpawnDefinition;

export type SpawnerRuntimeState = {
  definition: SpawnerDefinition;
  alive: boolean;
  hp: number;
  provoked: boolean;
  attackCooldownSeconds: number;
};

/** Persistent state belongs to the spawner identity, not to a transient enemy view. */
export function createSpawnState(roll: SpawnRoll): SavedSpawnState {
  return { killsToday: 0, defeatedAt: null, respawnAt: null, roll };
}

export function respawnDeadline(now: number, killsToday: number, baseRespawnMs: number, tier: TierConfig, nextResetMs: number): number {
  const delay = baseRespawnMs * tier.respawnMultiplier * 2 ** Math.max(0, killsToday - 1);
  return Math.min(now + delay, nextResetMs);
}

export function shouldRespawn(state: SavedSpawnState, now: number): boolean {
  return state.respawnAt !== null && now >= state.respawnAt;
}
