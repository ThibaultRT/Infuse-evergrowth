import { BASE_HERO_BLUNT_ATTACK, BASE_HERO_MAX_HP, BASE_HERO_REGEN, SPAWNS } from './config';
import { rollSpawn } from './domain/spawning/SpawnRoll';
import type { DamageType, InventoryState, PlayerStats, SaveData, SavedSpawnState, StatSources } from './types';

const SAVE_KEY = 'infuse-evergrowth-save-v10';
const PREVIOUS_SAVE_KEYS = ['infuse-evergrowth-save-v9', 'infuse-evergrowth-save-v8', 'infuse-evergrowth-save-v7'];

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
  return Object.fromEntries(SPAWNS.map((spawn) => [spawn.id, { killsToday: 0, respawnAt: null, defeatedAt: null, roll: rollSpawn(spawn) }]));
}

function migrateSpawns(value: unknown): Record<string, SavedSpawnState> {
  const source = value && typeof value === 'object' ? value as Record<string, Partial<SavedSpawnState>> : {};
  return Object.fromEntries(SPAWNS.map((spawn) => {
    const previous = source[spawn.id];
    const roll = previous?.roll;
    const validRoll = roll && Number.isFinite(roll.maxHp) && Number.isFinite(roll.reward?.amount);
    return [spawn.id, {
      killsToday: Math.max(0, Number(previous?.killsToday) || 0),
      respawnAt: typeof previous?.respawnAt === 'number' ? previous.respawnAt : null,
      defeatedAt: typeof previous?.defeatedAt === 'number' ? previous.defeatedAt : null,
      roll: validRoll ? roll : rollSpawn(spawn)
    }];
  }));
}

function freshStat(base: number): StatSources {
  return { base, additive: { kills: 0, equipment: 0, other: 0 }, multiplicative: { equipment: 1, other: 1 } };
}

function freshStats(): PlayerStats {
  return {
    maxHp: freshStat(BASE_HERO_MAX_HP),
    attack: { blunt: freshStat(BASE_HERO_BLUNT_ATTACK), slash: freshStat(0), piercing: freshStat(0) },
    regen: freshStat(BASE_HERO_REGEN)
  };
}

function freshInventory(): InventoryState {
  return { items: {}, equipped: { hand1: null, hand2: null, orbit1: null, orbit2: null, helmet: null, armor: null, legs: null } };
}

function migrateInventory(value: unknown): InventoryState {
  const fresh = freshInventory();
  if (!value || typeof value !== 'object') return fresh;
  const source = value as { items?: unknown; equipped?: Partial<InventoryState['equipped']> };
  if (Array.isArray(source.items)) {
    for (const raw of source.items) {
      if (!raw || typeof raw !== 'object') continue;
      const itemId = String((raw as { id?: unknown }).id ?? '');
      if (itemId) fresh.items[itemId] = { itemId, level: 1, ascend: 0 };
    }
  }
  if (source.items && !Array.isArray(source.items) && typeof source.items === 'object') {
    for (const [itemId, raw] of Object.entries(source.items as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as { level?: unknown; ascend?: unknown };
      fresh.items[itemId] = { itemId, level: Math.max(1, Number(item.level) || 1), ascend: Math.max(0, Number(item.ascend) || 0) };
    }
  }
  fresh.equipped = { ...fresh.equipped, ...(source.equipped ?? {}) };
  return fresh;
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
  const fresh: SaveData = {
    version: 10,
    dailyKey: localDailyKey(),
    currentAreaId: 1,
    unlockedAreas: [1],
    defeatedBosses: [],
    stats: freshStats(),
    inventory: freshInventory(),
    spawns: emptySpawnState()
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? PREVIOUS_SAVE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Omit<Partial<SaveData>, 'version' | 'spawns'> & { version?: number; spawns?: unknown };
    if (![7, 8, 9, 10].includes(parsed.version ?? 0) || !parsed.stats) return fresh;
    const unlockedAreas = Array.from(new Set([1, ...(parsed.unlockedAreas ?? [])]));
    const requestedArea = parsed.currentAreaId ?? 1;
    return {
      version: 10,
      dailyKey: localDailyKey(),
      currentAreaId: unlockedAreas.includes(requestedArea) ? requestedArea : 1,
      unlockedAreas,
      defeatedBosses: parsed.defeatedBosses ?? [],
      stats: {
        maxHp: normalizeStat(parsed.stats.maxHp, BASE_HERO_MAX_HP),
        attack: { blunt: normalizeStat(parsed.stats.attack?.blunt, BASE_HERO_BLUNT_ATTACK), slash: normalizeStat(parsed.stats.attack?.slash, 0), piercing: normalizeStat(parsed.stats.attack?.piercing, 0) },
        regen: normalizeStat(parsed.stats.regen, BASE_HERO_REGEN)
      },
      inventory: migrateInventory(parsed.inventory),
      spawns: parsed.dailyKey === localDailyKey() ? migrateSpawns(parsed.spawns) : emptySpawnState()
    };
  } catch {
    return fresh;
  }
}

export const save = loadSave();
export function persist(): void { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
export function resetPermanentStats(): void { save.stats = freshStats(); }
export function statAdditiveTotal(stat: StatSources): number { return stat.base + Object.values(stat.additive).reduce((a, b) => a + b, 0); }
export function statMultiplierTotal(stat: StatSources): number { return Object.values(stat.multiplicative).reduce((a, b) => a * b, 1); }
export function statTotal(stat: StatSources): number { return statAdditiveTotal(stat) * statMultiplierTotal(stat); }
export function maxHeroHp(): number { return statTotal(save.stats.maxHp); }
export function heroDamage(type: DamageType): number { return statTotal(save.stats.attack[type]); }
export function heroRegen(): number { return statTotal(save.stats.regen); }
