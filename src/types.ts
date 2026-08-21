export type Tier = 'crystal' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type DamageType = 'blunt';
export type LootType = 'hp' | DamageType;
export type EquipmentSlotId = 'hand1' | 'hand2' | 'orbit1' | 'orbit2';

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
  defeatedAt: number | null;
  loot: LootType;
};

export type StatSources = {
  base: number;
  additive: Record<string, number>;
  multiplicative: Record<string, number>;
};

export type PlayerStats = {
  maxHp: StatSources;
  attack: Record<DamageType, StatSources>;
  regen: StatSources;
};

export type InventoryItem = {
  id: string;
  name: string;
};

export type InventoryState = {
  items: InventoryItem[];
  equipped: Record<EquipmentSlotId, string | null>;
};

export type SaveData = {
  version: 5;
  dailyKey: string;
  stats: PlayerStats;
  inventory: InventoryState;
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
