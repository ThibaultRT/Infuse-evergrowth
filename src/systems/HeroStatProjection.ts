import { EVASION_CHANCE_CAP, EVASION_RAW_SCALE, EVASION_RAW_TARGET, HERO_BLOCK_CHANCE_PERCENT, HERO_CRITICAL_CHANCE_PERCENT, HERO_CRITICAL_DAMAGE_PERCENT, HERO_SPEED, SPEED_MAX_MULTIPLIER, SPEED_RAW_SCALE, SPEED_RAW_TARGET } from '../config';
import type { DamageType, PlayerStats } from '../types';
import { statAdditiveTotal, statMultiplierTotal, statTotal } from '../domain/stats/StatSources';
import { logarithmicChance, logarithmicStat, rawEvasionChance, totalEvasionChance } from '../domain/combat/HeroStats';
import { speedMultiplier } from '../domain/stats/Speed';

export function maxHeroHp(stats: PlayerStats): number { return statTotal(stats.maxHp); }
export function heroDamage(stats: PlayerStats, type: DamageType): number { return statTotal(stats.attack[type]); }
export function heroRegen(stats: PlayerStats): number { return statTotal(stats.regen); }
export function heroSpeedMultiplier(stats: PlayerStats): number {
  const rawMultiplier = speedMultiplier(statAdditiveTotal(stats.speed), SPEED_RAW_SCALE, SPEED_RAW_TARGET, SPEED_MAX_MULTIPLIER);
  return rawMultiplier * statMultiplierTotal(stats.speed);
}
export function heroSpeed(stats: PlayerStats): number { return HERO_SPEED * heroSpeedMultiplier(stats); }
export function heroCriticalChance(stats: PlayerStats): number { return logarithmicChance(statTotal(stats.criticalChance), HERO_CRITICAL_CHANCE_PERCENT); }
export function heroCriticalDamageMultiplier(stats: PlayerStats): number { return 1 + logarithmicStat(statTotal(stats.criticalDamage), HERO_CRITICAL_DAMAGE_PERCENT) / 100; }
export function heroBlockChance(stats: PlayerStats): number { return logarithmicChance(statTotal(stats.blockChance), HERO_BLOCK_CHANCE_PERCENT); }

export function heroRawEvasionChance(stats: PlayerStats): number { return rawEvasionChance(Object.values(stats.evasion.raw).reduce((sum, value) => sum + value, 0), EVASION_RAW_SCALE, EVASION_RAW_TARGET, EVASION_CHANCE_CAP); }
export function heroEvasionChance(stats: PlayerStats): number { return totalEvasionChance(heroRawEvasionChance(stats), Object.values(stats.evasion.directChance), EVASION_CHANCE_CAP); }
