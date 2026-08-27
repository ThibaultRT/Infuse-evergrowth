import balance from './data/balance.json';
import area1 from './data/areas/area-1.json';
import area2 from './data/areas/area-2.json';
import area3 from './data/areas/area-3.json';
import connections from './data/areas/connections.json';
import type { AreaDefinition, CombatAffinity, SpawnDefinition, Tier, TierConfig, WorldConnection } from './types';

const tierBalance = balance.enemy.tiers;
const areaData = { areas: [area1, area2, area3], connections };
const colorNumber = (hex: string): number => Number.parseInt(hex.replace('#', ''), 16);
const tierConfig = (tier: Tier): TierConfig => {
  const source = tierBalance[tier];
  return {
    label: source.label,
    statMultiplier: source.statMultiplier,
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
  environmentTheme: area.environmentTheme,
  size: area.size,
  collision: (('collision' in area ? area.collision : []) as AreaDefinition['collision']).map((shape) => ({ ...shape, x: area.worldOrigin.x + shape.x, z: area.worldOrigin.z + shape.z }))
}));

export const SPAWNS: SpawnDefinition[] = areaData.areas.flatMap((area) =>
  area.spawns.map((spawn) => ({
    id: spawn.id,
    tier: spawn.tier as Tier,
    areaId: area.id,
    x: area.worldOrigin.x + spawn.x,
    z: area.worldOrigin.z + spawn.z,
    hp: spawn.hp,
    rewards: spawn.rewards as SpawnDefinition['rewards'],
    attackDamage: spawn.attackDamage,
    ...(spawn.isBoss ? { isBoss: true } : {}),
    ...(spawn.group ? { group: spawn.group } : {}),
    ...('enemyWeakness' in spawn ? { enemyWeakness: spawn.enemyWeakness as CombatAffinity | null } : {})
  }))
);

export const WORLD_CONNECTIONS: WorldConnection[] = areaData.connections.map((connection) => ({
  ...connection,
  axis: connection.axis as 'x' | 'z',
  visualStyle: connection.visualStyle as WorldConnection['visualStyle']
}));

export function areaById(areaId: number): AreaDefinition {
  return AREAS.find((area) => area.id === areaId) ?? AREAS[0];
}

export const BASE_RESPAWN_MS = balance.respawn.baseSeconds * 1000;
export const BASE_HERO_MAX_HP = balance.hero.baseMaxHp;
export const BASE_HERO_BLUNT_ATTACK = balance.hero.baseBluntAttack;
export const BASE_HERO_REGEN = balance.hero.baseRegenHpPerSecond;
export const HERO_SPEED = balance.hero.moveSpeed;
export const BASE_HERO_SPEED_RAW = balance.hero.baseSpeedRaw;
export const SPEED_RAW_SCALE = balance.hero.speedRawScale;
export const SPEED_RAW_TARGET = balance.hero.speedRawTarget;
export const SPEED_MAX_MULTIPLIER = balance.hero.speedMaxMultiplier;
export const BASE_HERO_CRITICAL_CHANCE_RAW = balance.hero.baseCriticalChanceRaw;
export const BASE_HERO_CRITICAL_DAMAGE_RAW = balance.hero.baseCriticalDamageRaw;
export const BASE_HERO_BLOCK_CHANCE_RAW = balance.hero.baseBlockChanceRaw;
export const HERO_CRITICAL_CHANCE_PERCENT = balance.hero.baseCriticalChancePercent;
export const HERO_CRITICAL_DAMAGE_PERCENT = balance.hero.baseCriticalDamagePercent;
export const HERO_BLOCK_CHANCE_PERCENT = balance.hero.baseBlockChancePercent;
export const BLOCKED_DAMAGE_MULTIPLIER = balance.hero.blockedDamageMultiplier;
export const EVASION_RAW_SCALE = balance.hero.evasionRawScale;
export const EVASION_RAW_TARGET = balance.hero.evasionRawTarget;
export const EVASION_CHANCE_CAP = balance.hero.evasionChanceCap;
export const HERO_ATTACK_RANGE_METERS = balance.hero.attackRangeMeters;
export const HERO_RESPAWN_DELAY_MS = balance.hero.respawnDelaySeconds * 1000;
export const ENEMY_AGGRO_RADIUS_METERS = balance.enemy.aggroRadiusMeters;
export const ENEMY_LEASH_RADIUS_METERS = balance.enemy.leashRadiusMeters;
export const ENEMY_ATTACK_RANGE_METERS = HERO_ATTACK_RANGE_METERS * balance.enemy.attackRangeMultiplier;
export const ENEMY_POSITIONING_RANGE_METERS = HERO_ATTACK_RANGE_METERS * balance.enemy.positioningRangeMultiplier;
export const ENEMY_ATTACK_COOLDOWN = balance.enemy.attackCooldownSeconds;
