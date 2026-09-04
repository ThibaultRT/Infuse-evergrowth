import balance from './data/balance.json';
import area1 from './data/areas/area-1.json';
import area2 from './data/areas/area-2.json';
import area3 from './data/areas/area-3.json';
import connections from './data/areas/connections.json';
import { AREA_WORLD_LAYOUTS, TRANSITION_WORLD_LAYOUTS, WORLD_LAYOUTS } from './data/world';
import { compileWorldCollision } from './domain/world/WorldCollisionCompiler';
import type { AreaDefinition, CombatAffinity, SpawnDefinition, Tier, TierConfig, WorldConnection } from './types';

const tierBalance = balance.enemy.tiers;
const areaData = { areas: [area1, area2, area3], connections };
const compiledCollision = compileWorldCollision(WORLD_LAYOUTS);
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
  ...(() => {
    const layout = AREA_WORLD_LAYOUTS.find((candidate) => candidate.areaId === area.id);
    if (!layout) throw new Error(`Missing world layout for area ${area.id}`);
    return {
      originX: layout.origin[0],
      originZ: layout.origin[2],
      size: layout.playableSize,
      collision: [...(compiledCollision.byAreaId[area.id] ?? [])],
    };
  })(),
  id: area.id,
  name: area.name,
  bossSpawnId: area.bossSpawnId,
  enemyWeapon: area.enemyWeapon as CombatAffinity,
  enemyWeakness: area.enemyWeakness as CombatAffinity,
  environmentTheme: area.environmentTheme,
}));

export const SPAWNS: SpawnDefinition[] = areaData.areas.flatMap((area) =>
  area.spawns.map((spawn) => {
    const layout = AREA_WORLD_LAYOUTS.find((candidate) => candidate.areaId === area.id);
    if (!layout) throw new Error(`Missing world layout for area ${area.id}`);
    return ({
    id: spawn.id,
    tier: spawn.tier as Tier,
    areaId: area.id,
    x: layout.origin[0] + spawn.x,
    z: layout.origin[2] + spawn.z,
    hp: spawn.hp,
    rewards: spawn.rewards as SpawnDefinition['rewards'],
    attackDamage: spawn.attackDamage,
    ...(spawn.isBoss ? { isBoss: true } : {}),
    ...(spawn.group ? { group: spawn.group } : {}),
    ...('enemyWeakness' in spawn ? { enemyWeakness: spawn.enemyWeakness as CombatAffinity | null } : {})
    });
  })
);

export const WORLD_CONNECTIONS: WorldConnection[] = areaData.connections.map((connection) => {
  const layout = TRANSITION_WORLD_LAYOUTS.find((candidate) => candidate.connectionId === connection.id);
  if (!layout) throw new Error(`Missing world layout for connection ${connection.id}`);
  return {
    ...connection,
    x: layout.origin[0] + (layout.axis === 'z' ? layout.crossingCenter : 0),
    z: layout.origin[2] + (layout.axis === 'x' ? layout.crossingCenter : 0),
    axis: layout.axis,
    width: layout.crossingWidth,
    ...('barrierDepth' in layout && layout.barrierDepth ? { barrierDepth: layout.barrierDepth } : {}),
    visualStyle: connection.visualStyle as WorldConnection['visualStyle'],
  };
});

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
export const VISUAL_STREAMING = {
  prefetchDistance: balance.visualStreaming.destinationPrefetchMeters,
  mountDistance: balance.visualStreaming.destinationMountMeters,
  unmountDistance: balance.visualStreaming.destinationUnmountMeters,
  enemyActivateDistance: balance.visualStreaming.enemyActivateMeters,
  enemyDeactivateDistance: balance.visualStreaming.enemyDeactivateMeters
} as const;
