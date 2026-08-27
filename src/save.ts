import { AREAS, BASE_HERO_BLOCK_CHANCE_RAW, BASE_HERO_BLUNT_ATTACK, BASE_HERO_CRITICAL_CHANCE_RAW, BASE_HERO_CRITICAL_DAMAGE_RAW, BASE_HERO_MAX_HP, BASE_HERO_REGEN, BASE_HERO_SPEED_RAW, HERO_BLOCK_CHANCE_PERCENT, HERO_CRITICAL_CHANCE_PERCENT, HERO_CRITICAL_DAMAGE_PERCENT, HERO_SPEED, SPAWNS } from './config';
import { EQUIPMENT_BY_ID } from './domain/items/EquipmentCatalog';
import { logarithmicChance, logarithmicStat } from './domain/combat/HeroStats';
import { rollSpawn } from './domain/spawning/SpawnRoll';
import type { DamageType, InventoryState, PlayerStats, SaveData, SavedSpawnState, StatSources } from './types';

const SAVE_KEY = 'infuse-evergrowth-save-v16';
const PREVIOUS_SAVE_KEYS = ['infuse-evergrowth-save-v15', 'infuse-evergrowth-save-v14', 'infuse-evergrowth-save-v13', 'infuse-evergrowth-save-v12', 'infuse-evergrowth-save-v11', 'infuse-evergrowth-save-v10', 'infuse-evergrowth-save-v9', 'infuse-evergrowth-save-v8', 'infuse-evergrowth-save-v7'];

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
const volatileValues = new Map<string, string>();
export const browserSaveStorage: SaveStorage = typeof localStorage === 'undefined' ? {
  getItem: (key) => volatileValues.get(key) ?? null,
  setItem: (key, value) => { volatileValues.set(key, value); }
} : localStorage;

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
    const rewardStillAllowed = roll
      ? spawn.rewards.some((reward) => reward.stat === roll.reward.stat && roll.reward.amount >= reward.min && roll.reward.amount <= reward.max)
      : false;
    const validRoll = roll && Number.isFinite(roll.maxHp) && Number.isFinite(roll.reward?.amount) && rewardStillAllowed;
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
    defense: { blunt: freshStat(0), slash: freshStat(0), piercing: freshStat(0) },
    regen: freshStat(BASE_HERO_REGEN),
    speed: freshStat(BASE_HERO_SPEED_RAW),
    criticalChance: freshStat(BASE_HERO_CRITICAL_CHANCE_RAW),
    criticalDamage: freshStat(BASE_HERO_CRITICAL_DAMAGE_RAW),
    blockChance: freshStat(BASE_HERO_BLOCK_CHANCE_RAW),
    evasion: freshStat(0)
  };
}

function emptyInventory(): InventoryState {
  return { items: {}, equipped: { hand1: null, orbit1: null, orbit2: null, orbit3: null, helmet: null, armor: null, legs: null, ring: null } };
}

function freshInventory(): InventoryState {
  return {
    items: { 'hammer-common': { itemId: 'hammer-common', level: 1, ascend: 0 } },
    equipped: { hand1: 'hammer-common', orbit1: null, orbit2: null, orbit3: null, helmet: null, armor: null, legs: null, ring: null }
  };
}

function migrateInventory(value: unknown, unlockedAreas: number[]): InventoryState {
  const fresh = emptyInventory();
  if (!value || typeof value !== 'object') return fresh;
  const source = value as { items?: unknown; equipped?: Partial<InventoryState['equipped']> };
  if (Array.isArray(source.items)) {
    for (const raw of source.items) {
      if (!raw || typeof raw !== 'object') continue;
      const itemId = String((raw as { id?: unknown }).id ?? '');
      if (EQUIPMENT_BY_ID.has(itemId)) fresh.items[itemId] = { itemId, level: 1, ascend: 0 };
    }
  }
  if (source.items && !Array.isArray(source.items) && typeof source.items === 'object') {
    for (const [itemId, raw] of Object.entries(source.items as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object' || !EQUIPMENT_BY_ID.has(itemId)) continue;
      const item = raw as { level?: unknown; ascend?: unknown };
      fresh.items[itemId] = { itemId, level: Math.max(1, Number(item.level) || 1), ascend: Math.max(0, Number(item.ascend) || 0) };
    }
  }
  const migratedEquipped = { ...source.equipped } as Record<string, string | null | undefined>;
  if ('hand2' in migratedEquipped) {
    migratedEquipped.orbit3 = migratedEquipped.orbit2;
    migratedEquipped.orbit2 = migratedEquipped.orbit1;
    migratedEquipped.orbit1 = migratedEquipped.hand2;
  }
  for (const slot of Object.keys(fresh.equipped) as (keyof InventoryState['equipped'])[]) {
    if (slot === 'orbit1' && !unlockedAreas.includes(2)) continue;
    const itemId = migratedEquipped[slot];
    const item = typeof itemId === 'string' ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    const compatible = item?.kind === 'weapon'
      ? ['hand1', 'orbit1', 'orbit2', 'orbit3'].includes(slot)
      : item?.kind === 'armor' && ({ helmet: 'helmet', armor: 'armor', boots: 'legs' } as const)[item.armorClass] === slot;
    if (compatible && fresh.items[itemId!]) fresh.equipped[slot] = itemId!;
  }
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

export function loadSave(storage: SaveStorage = browserSaveStorage, now = new Date()): SaveData {
  const fresh: SaveData = {
    version: 16,
    dailyKey: localDailyKey(now),
    currentAreaId: 1,
    unlockedAreas: [1],
    defeatedBosses: [],
    heroHp: BASE_HERO_MAX_HP,
    stats: freshStats(),
    inventory: freshInventory(),
    spawns: emptySpawnState(),
    soulCatcher: { balances: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }, nodeLevels: {}, unlockAnnouncementSeen: false }
  };
  try {
    const raw = storage.getItem(SAVE_KEY) ?? PREVIOUS_SAVE_KEYS.map((key) => storage.getItem(key)).find(Boolean);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Omit<Partial<SaveData>, 'version' | 'spawns'> & { version?: number; spawns?: unknown };
    if (![7, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(parsed.version ?? 0) || !parsed.stats) return fresh;
    const areaIds = new Set(AREAS.map((area) => area.id));
    const spawnIds = new Set(SPAWNS.map((spawn) => spawn.id));
    const unlockedAreas = Array.from(new Set([1, ...(Array.isArray(parsed.unlockedAreas) ? parsed.unlockedAreas : [])])).filter((id): id is number => typeof id === 'number' && areaIds.has(id));
    const requestedArea = parsed.currentAreaId ?? 1;
    const stats: PlayerStats = {
      maxHp: normalizeStat(parsed.stats.maxHp, BASE_HERO_MAX_HP),
      attack: { blunt: normalizeStat(parsed.stats.attack?.blunt, BASE_HERO_BLUNT_ATTACK), slash: normalizeStat(parsed.stats.attack?.slash, 0), piercing: normalizeStat(parsed.stats.attack?.piercing, 0) },
      defense: { blunt: normalizeStat(parsed.stats.defense?.blunt, 0), slash: normalizeStat(parsed.stats.defense?.slash, 0), piercing: normalizeStat(parsed.stats.defense?.piercing, 0) },
      regen: normalizeStat(parsed.stats.regen, BASE_HERO_REGEN),
      speed: normalizeStat(parsed.stats.speed, BASE_HERO_SPEED_RAW),
      criticalChance: normalizeStat(parsed.stats.criticalChance, BASE_HERO_CRITICAL_CHANCE_RAW),
      criticalDamage: normalizeStat(parsed.stats.criticalDamage, BASE_HERO_CRITICAL_DAMAGE_RAW),
      blockChance: normalizeStat(parsed.stats.blockChance, BASE_HERO_BLOCK_CHANCE_RAW),
      evasion: normalizeStat(parsed.stats.evasion, 0)
    };
    const maxHp = statTotal(stats.maxHp);
    return {
      version: 16,
      dailyKey: localDailyKey(now),
      currentAreaId: typeof requestedArea === 'number' && areaIds.has(requestedArea) && unlockedAreas.includes(requestedArea) ? requestedArea : 1,
      unlockedAreas,
      defeatedBosses: Array.isArray(parsed.defeatedBosses) ? parsed.defeatedBosses.filter((id): id is string => typeof id === 'string' && spawnIds.has(id)) : [],
      heroHp: (parsed.version ?? 0) >= 12 && Number.isFinite(parsed.heroHp) ? Math.max(0, Math.min(Number(parsed.heroHp), maxHp)) : maxHp,
      stats,
      inventory: migrateInventory(parsed.inventory, unlockedAreas),
      spawns: parsed.dailyKey === localDailyKey(now) ? migrateSpawns(parsed.spawns) : emptySpawnState(),
      soulCatcher: normalizeSoulCatcher(parsed.soulCatcher)
    };
  } catch {
    return fresh;
  }
}

function normalizeSoulCatcher(value: unknown): SaveData['soulCatcher'] {
  const source = value && typeof value === 'object' ? value as Partial<SaveData['soulCatcher']> : {};
  const balance = (type: keyof SaveData['soulCatcher']['balances']): number => Math.max(0, Math.floor(Number(source.balances?.[type]) || 0));
  const nodeLevels = Object.fromEntries(Object.entries(source.nodeLevels ?? {}).filter(([id, level]) => /^SC-\d\d$/.test(id) && Number(level) > 0).map(([id, level]) => [id, Math.floor(Number(level))]));
  return { balances: { common: balance('common'), uncommon: balance('uncommon'), rare: balance('rare'), epic: balance('epic'), legendary: balance('legendary') }, nodeLevels, unlockAnnouncementSeen: source.unlockAnnouncementSeen === true };
}

export const save = loadSave();
export function persist(): void { browserSaveStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
export function resetPermanentStats(): void { save.stats = freshStats(); }
export function resetHeroProgress(): void {
  save.stats = freshStats();
  save.inventory = freshInventory();
}
export function statAdditiveTotal(stat: StatSources): number { return stat.base + Object.values(stat.additive).reduce((a, b) => a + b, 0); }
export function statMultiplierTotal(stat: StatSources): number { return Object.values(stat.multiplicative).reduce((a, b) => a * b, 1); }
export function statTotal(stat: StatSources): number { return statAdditiveTotal(stat) * statMultiplierTotal(stat); }
export function maxHeroHp(): number { return statTotal(save.stats.maxHp); }
export function heroDamage(type: DamageType): number { return statTotal(save.stats.attack[type]); }
export function heroRegen(): number { return statTotal(save.stats.regen); }
export function heroSpeed(): number { return logarithmicStat(statTotal(save.stats.speed), HERO_SPEED); }
export function heroCriticalChance(): number { return logarithmicChance(statTotal(save.stats.criticalChance), HERO_CRITICAL_CHANCE_PERCENT); }
export function heroCriticalDamageMultiplier(): number { return 1 + logarithmicStat(statTotal(save.stats.criticalDamage), HERO_CRITICAL_DAMAGE_PERCENT) / 100; }
export function heroBlockChance(): number { return logarithmicChance(statTotal(save.stats.blockChance), HERO_BLOCK_CHANCE_PERCENT); }
