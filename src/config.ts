import balance from './data/balance.json';
import areaData from './data/areas.json';
import type { AreaDefinition, CombatAffinity, DamageType, GateDefinition, SpawnDefinition, Tier, TierConfig } from './types';

const tierBalance = balance.enemy.tiers;
const colorNumber = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);
const tierConfig = (tier: Tier): TierConfig => {
  const source = tierBalance[tier];
  return {
    label: source.label,
    statMultiplier: source.statMultiplier,
    statReward: source.statReward,
    respawnMultiplier: source.respawnMultiplier,
    color: colorNumber(source.color),
    hostile: source.hostile
  };
};

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  crystal: tierConfig('crystal'),
  common: tierConfig('common'),
  uncommon: tierConfig('uncommon'),
  rare: tierConfig('rare'),
  epic: tierConfig('epic'),
  legendary: tierConfig('legendary')
};

export const AREAS: AreaDefinition[] = areaData.areas.map((area) => ({
  id: area.id,
  name: area.name,
  originX: area.worldOrigin.x,
  originZ: area.worldOrigin.z,
  bossSpawnId: area.bossSpawnId,
  enemyWeapon: area.enemyWeapon as CombatAffinity,
  enemyWeakness: area.enemyWeakness as CombatAffinity,
  environmentTheme: area.environmentTheme
}));

export const SPAWNS: SpawnDefinition[] = areaData.areas.flatMap((area) =>
  area.spawns.map((spawn) => ({
    id: spawn.id,
    tier: spawn.tier as Tier,
    areaId: area.id,
    x: area.worldOrigin.x + spawn.x,
    z: area.worldOrigin.z + spawn.z,
    ...(spawn.group ? { group: spawn.group } : {})
  }))
);

export const GATES: GateDefinition[] = areaData.areas.flatMap((area) =>
  area.gates.map((gate) => ({
    id: gate.id,
    tag: gate.tag,
    sourceAreaId: area.id,
    targetAreaId: gate.targetAreaId,
    x: area.worldOrigin.x + gate.x,
    z: area.worldOrigin.z + gate.z,
    requiresBossDefeated: gate.requiresBossDefeated
  }))
);

export function areaById(areaId: number): AreaDefinition {
  return AREAS.find((area) => area.id === areaId) ?? AREAS[0];
}

export function enemyMaxHp(areaId: number, tier: Tier): number {
  const commonHp = balance.enemy.commonBaseHp * balance.areaScaling.hpGrowthPerArea ** (areaId - 1);
  return Math.max(1, Math.round(commonHp * TIER_CONFIG[tier].statMultiplier));
}

export function enemyAttack(areaId: number, tier: Tier): number {
  const commonAttack = balance.enemy.commonBaseAttack * areaId * balance.areaScaling.attackMultiplierPerArea;
  return Math.max(1, Math.round(commonAttack * TIER_CONFIG[tier].statMultiplier));
}

export function enemyStatReward(areaId: number, tier: Tier): number {
  return TIER_CONFIG[tier].statReward * balance.areaScaling.statRewardMultiplierPerArea ** (areaId - 1);
}

export const BASE_RESPAWN_MS = balance.respawn.baseSeconds * 1000;
export const BASE_HERO_MAX_HP = balance.hero.baseMaxHp;
export const BASE_HERO_BLUNT_ATTACK = balance.hero.baseBluntAttack;
export const BASE_HERO_REGEN = balance.hero.baseRegenHpPerSecond;
export const BARE_HANDS_DAMAGE_TYPE: DamageType = 'blunt';
export const HERO_SPEED = balance.hero.moveSpeed;
export const HERO_ATTACK_RANGE_METERS = balance.hero.bareHandsRangeMeters;
export const HERO_ATTACK_COOLDOWN = balance.hero.attackCooldownSeconds;
export const HERO_RESPAWN_DELAY_MS = balance.hero.respawnDelaySeconds * 1000;
export const ENEMY_AGGRO_RADIUS_METERS = balance.enemy.aggroRadiusMeters;
export const ENEMY_LEASH_RADIUS_METERS = balance.enemy.leashRadiusMeters;
export const ENEMY_ATTACK_RANGE_METERS = HERO_ATTACK_RANGE_METERS * balance.enemy.attackRangeVsBareHandsMultiplier;
export const ENEMY_ATTACK_COOLDOWN = balance.enemy.attackCooldownSeconds;
export const LOOT_HP_WEIGHT = balance.loot.hpWeight;
