export type Tier = 'crystal' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type SpawnDefinition = {
  id: string;
  tier: Tier;
  x: number;
  z: number;
  group?: string;
};

export type SavedSpawnState = {
  killsToday: number;
  respawnAt: number | null;
};

export type StatSources = {
  base: number;
  additive: Record<string, number>;
  multiplicative: Record<string, number>;
};

export type PlayerStats = {
  maxHp: StatSources;
  attack: StatSources;
  regen: StatSources;
};

export type SaveData = {
  version: 3;
  dailyKey: string;
  stats: PlayerStats;
  spawns: Record<string, SavedSpawnState>;
};

export type TierConfig = {
  label: string;
  statMultiplier: number;
  statReward: number;
  respawnMultiplier: number;
  color: number;
  hostile: boolean;
};
