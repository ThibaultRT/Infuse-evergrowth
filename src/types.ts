export type Tier = 'crystal' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type DamageType = 'blunt' | 'slash' | 'piercing';
export type CombatAffinity = 'blunt' | 'slash' | 'pierce';
export type LootType = 'hp' | 'regen' | DamageType;
export type NumberRange = { min: number; max: number };
export type SpawnRewardDefinition = NumberRange & { stat: LootType };
export type SpawnRoll = { maxHp: number; reward: { stat: LootType; amount: number } };
export type WeaponSlotId = 'hand1' | 'hand2' | 'orbit1' | 'orbit2';
export type ArmorSlotId = 'helmet' | 'armor' | 'legs';
export type EquipmentSlotId = WeaponSlotId | ArmorSlotId;

export type SpawnDefinition = {
  id: string;
  tier: Tier;
  areaId: number;
  x: number;
  z: number;
  group?: string;
  hp: NumberRange;
  rewards: SpawnRewardDefinition[];
  isBoss?: boolean;
  enemyWeakness?: CombatAffinity | null;
};

export type AreaDefinition = {
  id: number;
  name: string;
  originX: number;
  originZ: number;
  bossSpawnId: string;
  enemyWeapon: CombatAffinity;
  enemyWeakness: CombatAffinity;
  environmentTheme: string;
};

export type GateDefinition = {
  id: string;
  tag: string;
  sourceAreaId: number;
  targetAreaId: number;
  x: number;
  z: number;
  requiresBossDefeated: boolean;
};

export type SavedSpawnState = {
  killsToday: number;
  respawnAt: number | null;
  defeatedAt: number | null;
  roll: SpawnRoll;
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
  speed: StatSources;
  criticalChance: StatSources;
  criticalDamage: StatSources;
  blockChance: StatSources;
};

export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type WeaponClass = 'sword' | 'hammer' | 'spear';
export type HandSlotId = 'hand1' | 'hand2';
export type ArmorClass = 'helmet' | 'armor' | 'boots';
type EquipmentBase = { id: string; name: string; rarity: EquipmentRarity; damageType: DamageType };
export type WeaponDefinition = EquipmentBase & { kind: 'weapon'; weaponClass: WeaponClass; baseDamage: number; baseDamagePerLevel: number; attackCooldownSeconds: number };
export type ArmorDefinition = EquipmentBase & { kind: 'armor'; armorClass: ArmorClass; baseDefensePerLevel: number };
export type EquipmentDefinition = WeaponDefinition | ArmorDefinition;
export type OwnedEquipment = { itemId: string; level: number; ascend: number };

export type InventoryState = {
  items: Record<string, OwnedEquipment>;
  equipped: Record<EquipmentSlotId, string | null>;
};

export type SaveData = {
  version: 11;
  dailyKey: string;
  currentAreaId: number;
  unlockedAreas: number[];
  defeatedBosses: string[];
  stats: PlayerStats;
  inventory: InventoryState;
  spawns: Record<string, SavedSpawnState>;
};

export type TierConfig = {
  label: string;
  statMultiplier: number;
  respawnMultiplier: number;
  color: number;
  hostile: boolean;
};
