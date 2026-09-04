import type { WorldCollisionShape } from './domain/world/WorldCollision';

export type Tier = 'crystal' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type DamageType = 'blunt' | 'slash' | 'piercing';
export type SoulType = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type CombatAffinity = 'blunt' | 'slash' | 'pierce';
export type LootType = 'hp' | 'regen' | 'speed' | 'evasion' | DamageType;
export type NumberRange = { min: number; max: number };
export type SpawnRewardDefinition = NumberRange & { stat: LootType };
export type SpawnRoll = { maxHp: number; reward: { stat: LootType; amount: number } };
export type WeaponSlotId = 'hand1' | 'orbit1' | 'orbit2' | 'orbit3';
export type ArmorSlotId = 'helmet' | 'armor' | 'legs' | 'ring';
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
  attackDamage: number;
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
  size: { width: number; depth: number };
  collision: CollisionShape[];
};

export type CollisionShape = WorldCollisionShape;

export type WorldConnection = {
  id: string;
  areaAId: number;
  areaBId: number;
  x: number;
  z: number;
  axis: 'x' | 'z';
  width: number;
  barrierDepth?: number;
  requiredUnlockedAreaId: number;
  unlockOnBossOfAreaId?: number;
  visualStyle: 'lake-gate' | 'ruined-fortress-gate';
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

/** Raw evasion is converted on a curve; direct chances are decimal probabilities added afterwards. */
export type EvasionSources = {
  raw: Record<'kills' | 'other', number>;
  directChance: Record<'equipment' | 'soulCatcher' | 'other', number>;
};

export type PlayerStats = {
  maxHp: StatSources;
  attack: Record<DamageType, StatSources>;
  defense: Record<DamageType, StatSources>;
  damageResistance: Record<DamageType, StatSources>;
  regen: StatSources;
  speed: StatSources;
  criticalChance: StatSources;
  criticalDamage: StatSources;
  blockChance: StatSources;
  evasion: EvasionSources;
};

export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type WeaponClass = 'sword' | 'hammer' | 'spear';
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
  version: 18;
  dailyKey: string;
  currentAreaId: number;
  unlockedAreas: number[];
  defeatedBosses: string[];
  heroHp: number;
  stats: PlayerStats;
  inventory: InventoryState;
  spawns: Record<string, SavedSpawnState>;
  soulCatcher: { balances: Record<SoulType, number>; nodeLevels: Record<string, number>; unlockAnnouncementSeen: boolean; xp: number; highestUnlockedLayer: number };
};

export type TierConfig = {
  label: string;
  statMultiplier: number;
  respawnMultiplier: number;
  color: number;
  hostile: boolean;
};
