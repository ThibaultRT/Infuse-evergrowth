import { AREAS, BASE_HERO_BLOCK_CHANCE_RAW, BASE_HERO_BLUNT_ATTACK, BASE_HERO_CRITICAL_CHANCE_RAW, BASE_HERO_CRITICAL_DAMAGE_RAW, BASE_HERO_MAX_HP, BASE_HERO_REGEN, BASE_HERO_SPEED_RAW, SPAWNS } from './config';
import { EQUIPMENT_BY_ID } from './domain/items/EquipmentCatalog';
import { statTotal } from './domain/stats/StatSources';
import { rollSpawn } from './domain/spawning/SpawnRoll';
import { SOUL_LAYER_REGISTRY, SOUL_NODE_BY_ID } from './data/soul-catcher';
import { soulCost, soulPurchaseXp } from './domain/soul-catcher';
import { WORLD_CONNECTIONS } from './config';
import { bossUnlockedConnections } from './domain/world/GateUnlocks';
import { circleOverlapsWorldCollision } from './domain/world/CollisionMath';
import { MINION_PIT } from './data/world/minionPit';
import { emptyMinionProgression, freshMinionStats, emptySoulContributions, validMinionColor, MINION_SLOTS, minionPitPosition } from './domain/minions';
import type { EvasionSources, InventoryState, MinionProgression, MinionSlotId, PlayerStats, SaveData, SavedMinion, SavedSpawnState, StatSources } from './types';

const SAVE_KEY = 'infuse-evergrowth-save-v20';
const BACKUP_KEY = 'infuse-evergrowth-save-backup';
const PREVIOUS_SAVE_KEYS = ['infuse-evergrowth-save-v19', 'infuse-evergrowth-save-v18', 'infuse-evergrowth-save-v17', 'infuse-evergrowth-save-v16', 'infuse-evergrowth-save-v15', 'infuse-evergrowth-save-v14', 'infuse-evergrowth-save-v13', 'infuse-evergrowth-save-v12', 'infuse-evergrowth-save-v11', 'infuse-evergrowth-save-v10', 'infuse-evergrowth-save-v9', 'infuse-evergrowth-save-v8', 'infuse-evergrowth-save-v7'];

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;
const volatileValues = new Map<string, string>();
let storageFailed = false;
function reportStorageFailure(error: unknown): void {
  if (!storageFailed) console.warn('Progress could not be saved to this device.', error);
  storageFailed = true;
}
export const browserSaveStorage: SaveStorage = {
  getItem: (key) => {
    try { return typeof localStorage === 'undefined' ? volatileValues.get(key) ?? null : localStorage.getItem(key); }
    catch (error) { reportStorageFailure(error); return volatileValues.get(key) ?? null; }
  },
  setItem: (key, value) => {
    volatileValues.set(key, value);
    // Do not overwrite a save that could not be read earlier in this session.
    if (storageFailed) return;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); }
    catch (error) { reportStorageFailure(error); }
  }
};

function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '') ? Number(value) : NaN;
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

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
    // A valid roll belongs to this life, even if authored ranges changed since it was saved.
    const validRoll = roll && Number.isFinite(roll.maxHp) && roll.maxHp > 0
      && Number.isFinite(roll.reward?.amount) && roll.reward.amount >= 0
      && ['hp', 'regen', 'speed', 'evasion', 'blunt', 'slash', 'piercing'].includes(roll.reward.stat);
    return [spawn.id, {
      killsToday: nonNegativeInteger(previous?.killsToday),
      respawnAt: typeof previous?.respawnAt === 'number' && Number.isFinite(previous.respawnAt) && previous.respawnAt > 0 ? previous.respawnAt : null,
      defeatedAt: typeof previous?.defeatedAt === 'number' && Number.isFinite(previous.defeatedAt) && previous.defeatedAt > 0 ? previous.defeatedAt : null,
      roll: validRoll ? roll : rollSpawn(spawn)
    }];
  }));
}

function freshStat(base: number): StatSources {
  return { base, additive: { kills: 0, minions: 0, equipment: 0, other: 0 }, multiplicative: { equipment: 1, other: 1 } };
}

function freshEvasion(): EvasionSources {
  return { raw: { kills: 0, minions: 0, other: 0 }, directChance: { equipment: 0, soulCatcher: 0, other: 0 } };
}

function freshStats(): PlayerStats {
  return {
    maxHp: freshStat(BASE_HERO_MAX_HP),
    attack: { blunt: freshStat(BASE_HERO_BLUNT_ATTACK), slash: freshStat(0), piercing: freshStat(0) },
    defense: { blunt: freshStat(0), slash: freshStat(0), piercing: freshStat(0) },
    damageResistance: { blunt: freshStat(0), slash: freshStat(0), piercing: freshStat(0) },
    regen: freshStat(BASE_HERO_REGEN),
    speed: freshStat(BASE_HERO_SPEED_RAW),
    criticalChance: freshStat(BASE_HERO_CRITICAL_CHANCE_RAW),
    criticalDamage: freshStat(BASE_HERO_CRITICAL_DAMAGE_RAW),
    blockChance: freshStat(BASE_HERO_BLOCK_CHANCE_RAW),
    evasion: freshEvasion()
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
      fresh.items[itemId] = { itemId, level: Math.max(1, nonNegativeInteger(item.level, 1)), ascend: nonNegativeInteger(item.ascend) };
    }
  }
  const migratedEquipped = { ...source.equipped } as Record<string, string | null | undefined>;
  if ('hand2' in migratedEquipped) {
    migratedEquipped.orbit3 = migratedEquipped.orbit2;
    migratedEquipped.orbit2 = migratedEquipped.orbit1;
    migratedEquipped.orbit1 = migratedEquipped.hand2;
  }
  const equippedIds = new Set<string>();
  for (const slot of Object.keys(fresh.equipped) as (keyof InventoryState['equipped'])[]) {
    if (slot === 'orbit1' && !unlockedAreas.includes(2)) continue;
    const itemId = migratedEquipped[slot];
    const item = typeof itemId === 'string' ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    const compatible = item?.kind === 'weapon'
      ? ['hand1', 'orbit1', 'orbit2', 'orbit3'].includes(slot)
      : item?.kind === 'armor' && ({ helmet: 'helmet', armor: 'armor', boots: 'legs' } as const)[item.armorClass] === slot;
    if (compatible && fresh.items[itemId!] && !equippedIds.has(itemId!)) {
      fresh.equipped[slot] = itemId!;
      equippedIds.add(itemId!);
    }
  }
  return fresh;
}

function normalizeStat(stat: Partial<StatSources> | undefined, base: number): StatSources {
  const fresh = freshStat(base);
  const validSources = (value: unknown): Record<string, number> => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([, amount]) => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0)) : {};
  return {
    base: typeof stat?.base === 'number' && Number.isFinite(stat.base) && stat.base >= 0 ? stat.base : fresh.base,
    additive: { ...fresh.additive, ...validSources(stat?.additive) },
    multiplicative: { ...fresh.multiplicative, ...validSources(stat?.multiplicative) }
  };
}

function normalizeStats(source: Partial<PlayerStats>, defaults: PlayerStats): PlayerStats {
  const typed = (kind: 'attack' | 'defense' | 'damageResistance'): PlayerStats[typeof kind] => ({
    blunt: normalizeStat(source[kind]?.blunt, defaults[kind].blunt.base),
    slash: normalizeStat(source[kind]?.slash, defaults[kind].slash.base),
    piercing: normalizeStat(source[kind]?.piercing, defaults[kind].piercing.base)
  });
  return {
    maxHp: normalizeStat(source.maxHp, defaults.maxHp.base), attack: typed('attack'), defense: typed('defense'), damageResistance: typed('damageResistance'),
    regen: normalizeStat(source.regen, defaults.regen.base), speed: normalizeStat(source.speed, defaults.speed.base),
    criticalChance: normalizeStat(source.criticalChance, defaults.criticalChance.base), criticalDamage: normalizeStat(source.criticalDamage, defaults.criticalDamage.base),
    blockChance: normalizeStat(source.blockChance, defaults.blockChance.base), evasion: normalizeEvasion(source.evasion)
  };
}

function reachableAreas(unlockedAreas: number[]): Set<number> {
  const reached = new Set([1]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const gate of WORLD_CONNECTIONS) {
      if (!unlockedAreas.includes(gate.requiredUnlockedAreaId)) continue;
      const next = reached.has(gate.areaAId) ? gate.areaBId : reached.has(gate.areaBId) ? gate.areaAId : null;
      if (next !== null && !reached.has(next)) { reached.add(next); changed = true; }
    }
  }
  return reached;
}

function validMinionLocation(areaId: number, x: number, z: number, unlockedAreas: number[]): boolean {
  const area = AREAS.find((candidate) => candidate.id === areaId);
  if (!area || !reachableAreas(unlockedAreas).has(areaId) || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  const inside = Math.abs(x - area.originX) <= area.size.width / 2 - .45 && Math.abs(z - area.originZ) <= area.size.depth / 2 - .45;
  const corridor = WORLD_CONNECTIONS.some((gate) => unlockedAreas.includes(gate.requiredUnlockedAreaId)
    && (gate.areaAId === areaId || gate.areaBId === areaId)
    && Math.abs(gate.axis === 'x' ? z - gate.z : x - gate.x) <= gate.width / 2 - .45
    && Math.abs(gate.axis === 'x' ? x - gate.x : z - gate.z) <= Math.max(4, (gate.barrierDepth ?? 0) + 4));
  if (!inside && !corridor) return false;
  return !area.collision.some((shape) => {
    if (shape.activation && unlockedAreas.includes(WORLD_CONNECTIONS.find((gate) => gate.id === shape.activation?.connectionId)?.requiredUnlockedAreaId ?? -1)) return false;
    return circleOverlapsWorldCollision({ x, z }, .45, shape);
  });
}

function normalizeMinions(value: unknown, unlockedAreas: number[], now: number, nodeLevels: Record<string, number>): MinionProgression {
  const source = value && typeof value === 'object' ? value as Partial<MinionProgression> & { unlockedEver?: boolean; paidSummonCount?: number } : {};
  const roster: SavedMinion[] = [];
  const ids = new Set<string>();
  const occupied = new Set<MinionSlotId>();
  for (const entry of Array.isArray(source.roster) ? source.roster : []) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(entry.id) || ids.has(entry.id)) continue;
    const preferred = MINION_SLOTS.includes(entry.slotId) ? entry.slotId : 1;
    const slotId = !occupied.has(preferred) ? preferred : MINION_SLOTS.find((slot) => !occupied.has(slot));
    if (!slotId) continue;
    occupied.add(slotId);
    ids.add(entry.id);
    const stats = normalizeStats(entry.stats && typeof entry.stats === 'object' ? entry.stats : {}, freshMinionStats());
    const savedDeadline = typeof entry.respawnAt === 'number' && Number.isFinite(entry.respawnAt) && entry.respawnAt > 0 ? entry.respawnAt : null;
    const expired = savedDeadline !== null && savedDeadline <= now;
    const location = !expired && validMinionLocation(entry.areaId, entry.position?.x, entry.position?.z, unlockedAreas)
      ? { areaId: entry.areaId, position: { x: entry.position.x, z: entry.position.z } }
      : { areaId: MINION_PIT.areaId, position: minionPitPosition(slotId) };
    const deadline = savedDeadline !== null && savedDeadline > now ? savedDeadline : null;
    const copiesEarned = Object.fromEntries(Object.entries(entry.copiesEarned ?? {}).filter(([id, count]) => EQUIPMENT_BY_ID.has(id) && typeof count === 'number' && Number.isSafeInteger(count) && count >= 0));
    const contributions = emptySoulContributions();
    for (const type of Object.keys(contributions) as (keyof typeof contributions)[]) contributions[type] = nonNegativeInteger(entry.soulContributions?.[type]);
    roster.push({ id: entry.id, slotId, color: validMinionColor(entry.color) ? entry.color : 'variant-1', ...location,
      hp: deadline ? 0 : expired ? statTotal(stats.maxHp) : Math.min(statTotal(stats.maxHp), Math.max(0, finiteNumber(entry.hp, statTotal(stats.maxHp)))), respawnAt: deadline,
      stats, inventory: migrateInventory(entry.inventory, unlockedAreas), copiesEarned, soulContributions: contributions });
  }
  const largestSerial = roster.reduce((max, minion) => {
    const serial = /^minion-[1-9]\d*$/.test(minion.id) ? Number(minion.id.slice(7)) : 0;
    return Number.isSafeInteger(serial) ? Math.max(max, serial) : max;
  }, 0);
  const requestedSerial = nonNegativeInteger(source.nextSerial, 1);
  const unlockedSlots = { 1: source.unlockedSlots?.[1] === true || source.unlockedEver === true || occupied.has(1) || !!nodeLevels['SC-MINION-01'],
    2: source.unlockedSlots?.[2] === true || occupied.has(2) || !!nodeLevels['SC-MINION-02'],
    3: source.unlockedSlots?.[3] === true || occupied.has(3) || !!nodeLevels['SC-MINION-03'] };
  return { nextSerial: Math.min(Number.MAX_SAFE_INTEGER, Math.max(largestSerial + 1, Number.isSafeInteger(requestedSerial) ? requestedSerial : 1, 1)), unlockedSlots, roster };
}

function normalizeEvasion(value: unknown): EvasionSources {
  const fresh = freshEvasion();
  if (!value || typeof value !== 'object') return fresh;
  const source = value as Partial<EvasionSources> & Partial<StatSources>;
  // v16 stored raw evasion directly as StatSources; retain every accumulated source.
  if (!('raw' in source)) {
    const kills = Math.max(0, finiteNumber(source.additive?.kills, 0));
    return { raw: { kills, minions: 0, other: Math.max(0, statTotal(normalizeStat(source, 0)) - kills) }, directChance: fresh.directChance };
  }
  return {
    raw: { kills: Math.max(0, finiteNumber(source.raw?.kills, 0)), minions: Math.max(0, finiteNumber(source.raw?.minions, 0)), other: Math.max(0, finiteNumber(source.raw?.other, 0)) },
    directChance: {
      equipment: Math.max(0, finiteNumber(source.directChance?.equipment, 0)),
      soulCatcher: Math.max(0, finiteNumber(source.directChance?.soulCatcher, 0)),
      other: Math.max(0, finiteNumber(source.directChance?.other, 0))
    }
  };
}

export function loadSave(storage: SaveStorage = browserSaveStorage, now = new Date()): SaveData {
  // A corrupt primary must not mask the last working save or supported legacy saves.
  for (const key of [SAVE_KEY, BACKUP_KEY, ...PREVIOUS_SAVE_KEYS]) {
    try {
      const raw = storage.getItem(key);
      const restored = raw ? decodeSave(raw, now) : null;
      if (restored) return restored;
    } catch { /* Unavailable storage is handled by the browser adapter. */ }
  }
  return {
    version: 20,
    dailyKey: localDailyKey(now),
    currentAreaId: 1,
    unlockedAreas: [1],
    defeatedBosses: [],
    heroHp: BASE_HERO_MAX_HP,
    stats: freshStats(),
    inventory: freshInventory(),
    spawns: emptySpawnState(),
    soulCatcher: { balances: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }, nodeLevels: {}, unlockAnnouncementSeen: false, xp: 0, highestUnlockedLayer: 1 },
    minions: emptyMinionProgression()
  };
}

function decodeSave(raw: string, now: Date): SaveData | null {
  try {
    const parsed = JSON.parse(raw) as Omit<Partial<SaveData>, 'version' | 'spawns'> & { version?: number; spawns?: unknown };
    if (!parsed || ![7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].includes(parsed.version ?? 0) || !parsed.stats || typeof parsed.stats !== 'object' || Array.isArray(parsed.stats)) return null;
    const areaIds = new Set(AREAS.map((area) => area.id));
    const spawnIds = new Set(SPAWNS.map((spawn) => spawn.id));
    const unlockedAreas = Array.from(new Set([1, ...(Array.isArray(parsed.unlockedAreas) ? parsed.unlockedAreas : [])])).filter((id): id is number => typeof id === 'number' && areaIds.has(id));
    const defeatedBosses = Array.isArray(parsed.defeatedBosses) ? parsed.defeatedBosses.filter((id): id is string => typeof id === 'string' && spawnIds.has(id)) : [];
    // New routes honor already-earned boss victories; no replay or reroll is required.
    for (const connection of bossUnlockedConnections(AREAS, WORLD_CONNECTIONS, defeatedBosses)) {
      if (!unlockedAreas.includes(connection.requiredUnlockedAreaId)) unlockedAreas.push(connection.requiredUnlockedAreaId);
    }
    const requestedArea = parsed.currentAreaId ?? 1;
    const stats = normalizeStats(parsed.stats, freshStats());
    const maxHp = statTotal(stats.maxHp);
    const soulCatcher = normalizeSoulCatcher(parsed.soulCatcher);
    return {
      version: 20,
      dailyKey: localDailyKey(now),
      currentAreaId: typeof requestedArea === 'number' && areaIds.has(requestedArea) && unlockedAreas.includes(requestedArea) ? requestedArea : 1,
      unlockedAreas,
      defeatedBosses,
      heroHp: (parsed.version ?? 0) >= 12 && Number.isFinite(parsed.heroHp) ? Math.max(0, Math.min(Number(parsed.heroHp), maxHp)) : maxHp,
      stats,
      inventory: migrateInventory(parsed.inventory, unlockedAreas),
      spawns: parsed.dailyKey === localDailyKey(now) ? migrateSpawns(parsed.spawns) : emptySpawnState(),
      soulCatcher,
      minions: normalizeMinions(parsed.minions, unlockedAreas, now.getTime(), soulCatcher.nodeLevels)
    };
  } catch {
    return null;
  }
}

function normalizeSoulCatcher(value: unknown): SaveData['soulCatcher'] {
  const source = value && typeof value === 'object' ? value as Partial<SaveData['soulCatcher']> : {};
  const balance = (type: keyof SaveData['soulCatcher']['balances']): number => nonNegativeInteger(source.balances?.[type]);
  const nodeLevels = Object.fromEntries(Object.entries(source.nodeLevels ?? {}).flatMap(([id, rawLevel]) => {
    const canonicalId = id === 'SC-M01' ? 'SC-MINION-01' : id;
    const node = SOUL_NODE_BY_ID.get(canonicalId);
    const level = node ? Math.min(node.maxLevel, nonNegativeInteger(rawLevel)) : 0;
    return level > 0 ? [[canonicalId, level]] : [];
  }));
  const historicalXp = Object.entries(nodeLevels).reduce((total, [id, level]) => {
    const node = SOUL_NODE_BY_ID.get(id)!;
    let cost = 0;
    for (let purchasedLevel = 1; purchasedLevel <= level; purchasedLevel += 1) cost += soulCost(node, purchasedLevel);
    return total + soulPurchaseXp(node.cost.soulType, cost);
  }, 0);
  const xp = nonNegativeInteger(source.xp, historicalXp);
  const highestUnlockedLayer = SOUL_LAYER_REGISTRY.reduce((highest, metadata) => metadata.unlockXp !== null && xp >= metadata.unlockXp ? Math.max(highest, metadata.layer) : highest, Math.max(1, Math.min(10, nonNegativeInteger(source.highestUnlockedLayer, 1))));
  return { balances: { common: balance('common'), uncommon: balance('uncommon'), rare: balance('rare'), epic: balance('epic'), legendary: balance('legendary') }, nodeLevels, unlockAnnouncementSeen: source.unlockAnnouncementSeen === true, xp, highestUnlockedLayer };
}

export const save = loadSave();
/** Retains one validated previous save; concurrent tabs deliberately use last-write-wins. */
export function persist(state: SaveData = save, storage: SaveStorage = browserSaveStorage, now = new Date()): boolean {
  try {
    const next = JSON.stringify(state, (_key, value: unknown) => {
      if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Cannot save a non-finite number.');
      return value;
    });
    const previous = storage.getItem(SAVE_KEY);
    if (previous && decodeSave(previous, now)) storage.setItem(BACKUP_KEY, previous);
    else {
      const backup = storage.getItem(BACKUP_KEY);
      if (!backup || !decodeSave(backup, now)) storage.setItem(BACKUP_KEY, next);
    }
    storage.setItem(SAVE_KEY, next);
    return storage !== browserSaveStorage || !storageFailed;
  } catch (error) {
    console.warn('Progress could not be saved to this device.', error);
    return false;
  }
}
export function resetPermanentStats(state: SaveData): void { state.stats = freshStats(); }
export function resetHeroProgress(state: SaveData): void {
  state.stats = freshStats();
  state.inventory = freshInventory();
}
export { statAdditiveTotal, statMultiplierTotal, statTotal } from './domain/stats/StatSources';
