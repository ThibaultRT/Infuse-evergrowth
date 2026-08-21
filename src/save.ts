import { BASE_HERO_BLUNT_ATTACK, BASE_HERO_MAX_HP, BASE_HERO_REGEN, SPAWNS } from './config';
import type { DamageType, PlayerStats, SaveData, SavedSpawnState, StatSources } from './types';

const SAVE_KEY = 'infuse-evergrowth-save-v4';

export function localDailyKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextLocalMidnightMs(now = new Date()): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0).getTime();
}

export function emptySpawnState(): Record<string, SavedSpawnState> {
  return Object.fromEntries(SPAWNS.map((s) => [s.id, { killsToday: 0, respawnAt: null }]));
}

function freshStat(base: number): StatSources {
  return { base, additive: { kills: 0, equipment: 0, other: 0 }, multiplicative: { equipment: 1, other: 1 } };
}

function freshStats(): PlayerStats {
  return {
    maxHp: freshStat(BASE_HERO_MAX_HP),
    attack: { blunt: freshStat(BASE_HERO_BLUNT_ATTACK) },
    regen: freshStat(BASE_HERO_REGEN)
  };
}

function normalizeStat(stat: Partial<StatSources> | undefined, base: number): StatSources {
  const fresh = freshStat(base);
  return {
    base: typeof stat?.base === 'number' ? stat.base : fresh.base,
    additive: { ...fresh.additive, ...(stat?.additive ?? {}) },
    multiplicative: { ...fresh.multiplicative, ...(stat?.multiplicative ?? {}) }
  };
}

function loadSave(): SaveData {
  const fresh: SaveData = { version: 4, dailyKey: localDailyKey(), stats: freshStats(), spawns: emptySpawnState() };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 4 || !parsed.stats) return fresh;
    return {
      version: 4,
      dailyKey: localDailyKey(),
      stats: {
        maxHp: normalizeStat(parsed.stats.maxHp, BASE_HERO_MAX_HP),
        attack: { blunt: normalizeStat(parsed.stats.attack?.blunt, BASE_HERO_BLUNT_ATTACK) },
        regen: normalizeStat(parsed.stats.regen, BASE_HERO_REGEN)
      },
      spawns: parsed.dailyKey === localDailyKey() ? { ...emptySpawnState(), ...(parsed.spawns ?? {}) } : emptySpawnState()
    };
  } catch {
    return fresh;
  }
}

export const save = loadSave();
export function persist(): void { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
export function statAdditiveTotal(stat: StatSources): number { return stat.base + Object.values(stat.additive).reduce((a, b) => a + b, 0); }
export function statMultiplierTotal(stat: StatSources): number { return Object.values(stat.multiplicative).reduce((a, b) => a * b, 1); }
export function statTotal(stat: StatSources): number { return statAdditiveTotal(stat) * statMultiplierTotal(stat); }
export function maxHeroHp(): number { return statTotal(save.stats.maxHp); }
export function heroDamage(type: DamageType): number { return statTotal(save.stats.attack[type]); }
export function heroRegen(): number { return statTotal(save.stats.regen); }
