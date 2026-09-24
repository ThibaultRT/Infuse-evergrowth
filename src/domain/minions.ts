import balance from '../data/balance.json';
import { MINION_PIT } from '../data/world/minionPit';
import { EQUIPMENT_BY_ID } from './items/EquipmentCatalog';
import { ascendOwnedEquipment, canAscend, equipmentDamage, equipmentDefense } from './items/EquipmentProgression';
import { statTotal } from './stats/StatSources';
import type { DamageType, EquipmentSlotId, InventoryState, LootType, MinionColorVariant, MinionProgression, PlayerStats, SavedMinion, SoulType, StatSources } from '../types';

const colors: MinionColorVariant[] = ['variant-1', 'variant-2', 'variant-3'];
const weaponSlots = ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const;
const armorSlot = { helmet: 'helmet', armor: 'armor', boots: 'legs' } as const;
const stat = (base: number): StatSources => ({ base, additive: { kills: 0, minions: 0, equipment: 0, other: 0 }, multiplicative: { equipment: 1, other: 1 } });

export function freshMinionStats(): PlayerStats {
  const hero = balance.hero;
  return {
    maxHp: stat(hero.baseMaxHp * balance.minions.healthMultiplier),
    attack: { blunt: stat(hero.baseBluntAttack), slash: stat(0), piercing: stat(0) },
    defense: { blunt: stat(0), slash: stat(0), piercing: stat(0) },
    damageResistance: { blunt: stat(0), slash: stat(0), piercing: stat(0) },
    regen: stat(hero.baseRegenHpPerSecond), speed: stat(hero.baseSpeedRaw),
    criticalChance: stat(hero.baseCriticalChanceRaw), criticalDamage: stat(hero.baseCriticalDamageRaw), blockChance: stat(hero.baseBlockChanceRaw),
    evasion: { raw: { kills: 0, minions: 0, other: 0 }, directChance: { equipment: 0, soulCatcher: 0, other: 0 } }
  };
}

export function emptyMinionInventory(): InventoryState {
  return { items: {}, equipped: { hand1: null, orbit1: null, orbit2: null, orbit3: null, helmet: null, armor: null, legs: null, ring: null } };
}

export function emptyMinionProgression(): MinionProgression { return { nextSerial: 1, unlockedEver: false, paidSummonCount: 0, roster: [] }; }
export function nextSummonCost(paidSummonCount: number): number { return balance.minions.baseSummonCost * balance.minions.summonCostMultiplier ** paidSummonCount; }
export function minionColor(random: () => number): MinionColorVariant {
  const value = random();
  return colors[Number.isFinite(value) ? Math.min(colors.length - 1, Math.max(0, Math.floor(value * colors.length))) : 0];
}
export function validMinionColor(value: unknown): value is MinionColorVariant { return colors.includes(value as MinionColorVariant); }
export function createMinion(id: string, random: () => number): SavedMinion {
  const stats = freshMinionStats();
  return { id, color: minionColor(random), areaId: MINION_PIT.areaId, position: { x: MINION_PIT.x, z: MINION_PIT.z }, hp: statTotal(stats.maxHp), respawnAt: null,
    stats, inventory: emptyMinionInventory(), copiesEarned: {}, soulContributions: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 } };
}
export function shouldRecover(hp: number, maxHp: number): boolean { return hp < maxHp * balance.minions.recoveryStartFraction; }
export function recoveryComplete(hp: number, maxHp: number): boolean { return hp >= maxHp * balance.minions.recoveryEndFraction; }
export function compareTarget(a: { distance: number; id: string }, b: { distance: number; id: string }): number {
  return a.distance - b.distance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function itemValue(id: string, inventory: InventoryState): number {
  const definition = EQUIPMENT_BY_ID.get(id), owned = inventory.items[id];
  return definition && owned ? definition.kind === 'weapon' ? equipmentDamage(definition, owned) : equipmentDefense(definition, owned) : -Infinity;
}

/** Applies copies, all available Ascends, and deterministic raw-value auto-equipment. */
export function applyMinionDrop(minion: SavedMinion, itemId: string, quantity: number, unlockedAreas: readonly number[]): EquipmentSlotId | null {
  const definition = EQUIPMENT_BY_ID.get(itemId);
  if (!definition || !Number.isSafeInteger(quantity) || quantity <= 0) return null;
  minion.copiesEarned[itemId] = (minion.copiesEarned[itemId] ?? 0) + quantity;
  const current = minion.inventory.items[itemId] ?? { itemId, level: 0, ascend: 0 };
  current.level += quantity;
  minion.inventory.items[itemId] = current;
  while (canAscend(definition, minion.inventory.items[itemId])) minion.inventory.items[itemId] = ascendOwnedEquipment(definition, minion.inventory.items[itemId]);
  const slots: EquipmentSlotId[] = definition.kind === 'weapon' ? weaponSlots.filter((slot) => slot !== 'orbit1' || unlockedAreas.includes(2)) : [armorSlot[definition.armorClass]];
  const equipped = minion.inventory.equipped;
  const already = slots.find((slot) => equipped[slot] === itemId);
  if (already) return already;
  const free = slots.find((slot) => equipped[slot] === null);
  if (free) { equipped[free] = itemId; return free; }
  const weakest = slots.map((slot) => ({ slot, id: equipped[slot]! })).sort((a, b) => itemValue(a.id, minion.inventory) - itemValue(b.id, minion.inventory) || slots.indexOf(a.slot) - slots.indexOf(b.slot))[0];
  if (weakest && itemValue(itemId, minion.inventory) > itemValue(weakest.id, minion.inventory)) { equipped[weakest.slot] = itemId; return weakest.slot; }
  return null;
}

export type Infusion = { stats: Record<LootType, number>; copies: Record<string, number> };
export function calculateInfusion(roster: readonly SavedMinion[]): Infusion {
  const stats: Infusion['stats'] = { hp: 0, regen: 0, speed: 0, evasion: 0, blunt: 0, slash: 0, piercing: 0 };
  const copies: Record<string, number> = {};
  for (const minion of roster) {
    stats.hp += (minion.stats.maxHp.additive.kills ?? 0) * 0.5;
    stats.regen += (minion.stats.regen.additive.kills ?? 0) * 0.5;
    stats.speed += (minion.stats.speed.additive.kills ?? 0) * 0.5;
    stats.evasion += minion.stats.evasion.raw.kills * 0.5;
    for (const type of ['blunt', 'slash', 'piercing'] as DamageType[]) stats[type] += (minion.stats.attack[type].additive.kills ?? 0) * 0.5;
    for (const [id, count] of Object.entries(minion.copiesEarned)) if (count > 0 && EQUIPMENT_BY_ID.has(id)) copies[id] = (copies[id] ?? 0) + count;
  }
  return { stats, copies };
}

export function emptySoulContributions(): Record<SoulType, number> { return { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }; }
