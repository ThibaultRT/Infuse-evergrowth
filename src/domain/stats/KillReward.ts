import { statTotal } from './StatSources';
import type { LootType, PlayerStats } from '../../types';

/** Apply one persisted spawn reward to exactly one actor's kill sources. */
export function awardKillStat(stats: PlayerStats, hp: number, reward: { stat: LootType; amount: number }): number {
  if (reward.stat === 'hp') {
    const oldMax = statTotal(stats.maxHp);
    stats.maxHp.additive.kills = (stats.maxHp.additive.kills ?? 0) + reward.amount;
    return Math.min(statTotal(stats.maxHp), hp + statTotal(stats.maxHp) - oldMax);
  }
  if (reward.stat === 'evasion') stats.evasion.raw.kills += reward.amount;
  else if (reward.stat === 'regen' || reward.stat === 'speed') stats[reward.stat].additive.kills = (stats[reward.stat].additive.kills ?? 0) + reward.amount;
  else stats.attack[reward.stat].additive.kills = (stats.attack[reward.stat].additive.kills ?? 0) + reward.amount;
  return hp;
}
