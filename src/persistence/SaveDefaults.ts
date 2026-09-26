import { BASE_HERO_BLOCK_CHANCE_RAW, BASE_HERO_BLUNT_ATTACK, BASE_HERO_CRITICAL_CHANCE_RAW, BASE_HERO_CRITICAL_DAMAGE_RAW, BASE_HERO_MAX_HP, BASE_HERO_REGEN, BASE_HERO_SPEED_RAW, SPAWNS } from '../config';
import { rollSpawn } from '../domain/spawning/SpawnRoll';
import { emptyMinionProgression } from '../domain/minions';
import { localDailyKey } from '../domain/time/LocalCalendar';
import type { EvasionSources, InventoryState, PlayerStats, SaveData, SavedSpawnState, StatSources } from '../types';

export function emptySpawnState(): Record<string, SavedSpawnState> {
  return Object.fromEntries(SPAWNS.map((spawn) => [spawn.id, { killsToday: 0, respawnAt: null, defeatedAt: null, roll: rollSpawn(spawn) }]));
}

export function freshStat(base: number): StatSources {
  return { base, additive: { kills: 0, minions: 0, equipment: 0, other: 0 }, multiplicative: { equipment: 1, other: 1 } };
}

export function freshEvasion(): EvasionSources {
  return { raw: { kills: 0, minions: 0, other: 0 }, directChance: { equipment: 0, soulCatcher: 0, other: 0 } };
}

export function freshStats(): PlayerStats {
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

export function emptyInventory(): InventoryState {
  return { items: {}, equipped: { hand1: null, orbit1: null, orbit2: null, orbit3: null, helmet: null, armor: null, legs: null, ring: null } };
}

export function freshInventory(): InventoryState {
  return {
    items: { 'hammer-common': { itemId: 'hammer-common', level: 1, ascend: 0 } },
    equipped: { hand1: 'hammer-common', orbit1: null, orbit2: null, orbit3: null, helmet: null, armor: null, legs: null, ring: null }
  };
}

export function createNewSave(now = new Date()): SaveData {
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

export function resetPermanentStats(state: SaveData): void { state.stats = freshStats(); }
export function resetHeroProgress(state: SaveData): void {
  state.stats = freshStats();
  state.inventory = freshInventory();
}
