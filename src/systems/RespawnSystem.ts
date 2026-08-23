import { respawnDeadline, shouldRespawn } from '../domain/spawning/SpawnerModel';
import { rollSpawn } from '../domain/spawning/SpawnRoll';
import type { SavedSpawnState, SpawnDefinition, TierConfig } from '../types';

/** Owns persistent per-life spawner transitions and rerolls. */
export class RespawnSystem {
  defeat(state: SavedSpawnState, tier: TierConfig, now: number, baseRespawnMs: number, nextResetMs: number): void {
    state.killsToday += 1;
    state.defeatedAt = now;
    state.respawnAt = respawnDeadline(now, state.killsToday, baseRespawnMs, tier, nextResetMs);
  }

  reviveIfDue(state: SavedSpawnState, definition: SpawnDefinition, now: number): boolean {
    if (!shouldRespawn(state, now)) return false;
    this.reroll(state, definition);
    return true;
  }

  reroll(state: SavedSpawnState, definition: SpawnDefinition): void {
    state.respawnAt = null;
    state.defeatedAt = null;
    state.roll = rollSpawn(definition);
  }
}
