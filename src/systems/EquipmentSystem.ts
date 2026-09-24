import { heroRegen, maxHeroHp } from './HeroStats';
import { statTotal } from '../domain/stats/StatSources';
import type { ArmorSlotId, DamageType, EquipmentSlotId, OwnedEquipment, WeaponSlotId, SaveData, StatSources, InventoryState, PlayerStats } from '../types';
import { EQUIPMENT, EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';
import { ascendCopies, ascendOwnedEquipment, canAscend, equipmentAscendValue, equipmentDamage, equipmentDefense, equipmentValuePerLevel } from '../domain/items/EquipmentProgression';

export { EQUIPMENT, EQUIPMENT_BY_ID, ascendCopies, equipmentAscendValue, equipmentDamage, equipmentDefense, equipmentValuePerLevel };

export type AttackProfile = { itemId: string; damage: number; damageType: DamageType; cooldownSeconds: number; sources: StatSources };
export type InventoryCombatSummary = {
  totalAttack: number;
  maxHp: number;
  regenPerSecond: number;
  attackByType: Record<DamageType, number>;
  defenseByType: Record<DamageType, number>;
};

/**
 * Runtime equipment orchestration. Static definitions and progression math live
 * in the item domain; this system only connects them to persistent player state.
 */
export function attackProfile(state: { stats: PlayerStats; inventory: InventoryState }, hand: WeaponSlotId): AttackProfile | null {
  const itemId = state.inventory.equipped[hand];
  const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
  const owned = itemId ? state.inventory.items[itemId] : undefined;
  if (item?.kind !== 'weapon' || !owned) return null;
  // Each independently scheduled hit contains its own weapon's additive damage.
  const stat = state.stats.attack[item.damageType];
  const sources = { ...stat, additive: { ...stat.additive, equippedWeapon: equipmentDamage(item, owned) } };
  return { itemId: item.id, damage: statTotal(sources), damageType: item.damageType, cooldownSeconds: item.attackCooldownSeconds, sources };
}

export function applyEquipmentCopies(state: SaveData, itemId: string, quantity: number): { previousLevel: number | null; owned: OwnedEquipment } {
  const previous = state.inventory.items[itemId];
  const owned = previous ?? { itemId, level: 0, ascend: 0 };
  const previousLevel = previous?.level ?? null;
  owned.level += quantity;
  state.inventory.items[itemId] = owned;
  return { previousLevel, owned };
}

const ARMOR_SLOT: Record<'helmet' | 'armor' | 'boots', ArmorSlotId> = { helmet: 'helmet', armor: 'armor', boots: 'legs' };

export function equipmentSlot(itemId: string): EquipmentSlotId | null {
  const item = EQUIPMENT_BY_ID.get(itemId);
  return item?.kind === 'armor' ? ARMOR_SLOT[item.armorClass] : null;
}

export function equipmentSlotUnlocked(state: SaveData, slot: EquipmentSlotId): boolean {
  return slot !== 'orbit1' || state.unlockedAreas.includes(2);
}

export function equip(state: SaveData, itemId: string, slot: EquipmentSlotId): boolean {
  const item = EQUIPMENT_BY_ID.get(itemId);
  if (!state.inventory.items[itemId] || !item || !equipmentSlotUnlocked(state, slot)) return false;
  const armorSlot = item.kind === 'armor' ? ARMOR_SLOT[item.armorClass] : null;
  if ((armorSlot && slot !== armorSlot) || (!armorSlot && !['hand1', 'orbit1', 'orbit2', 'orbit3'].includes(slot))) return false;
  for (const other of Object.keys(state.inventory.equipped) as EquipmentSlotId[]) if (other !== slot && state.inventory.equipped[other] === itemId) state.inventory.equipped[other] = null;
  state.inventory.equipped[slot] = itemId;
  return true;
}

export function unequip(state: SaveData, hand: EquipmentSlotId): string | null {
  const itemId = state.inventory.equipped[hand];
  state.inventory.equipped[hand] = null;
  return itemId;
}

export function ascend(state: SaveData, itemId: string): boolean {
  const owned = state.inventory.items[itemId];
  const item = EQUIPMENT_BY_ID.get(itemId);
  if (!owned || !item || !canAscend(item, owned)) return false;
  state.inventory.items[itemId] = ascendOwnedEquipment(item, owned);
  return true;
}

export function equippedDefense(state: { stats: PlayerStats; inventory: InventoryState }, type: DamageType): number {
  return statTotal(defenseSources(state, type));
}

export function defenseSources(state: { stats: PlayerStats; inventory: InventoryState }, type: DamageType): StatSources {
  const armor = (['helmet', 'armor', 'legs'] as const).reduce((total, slot) => {
    const itemId = state.inventory.equipped[slot];
    const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    const owned = itemId ? state.inventory.items[itemId] : undefined;
    return total + (item?.damageType === type && owned ? equipmentDefense(item, owned) : 0);
  }, 0);
  const stat = state.stats.defense[type];
  return { ...stat, additive: { ...stat.additive, equippedArmor: armor } };
}

/** Plain-value projection of the authoritative equipment and hero stat rules used by combat. */
export function equipmentCombatSummary(state: SaveData): InventoryCombatSummary {
  const damageTypes: DamageType[] = ['blunt', 'slash', 'piercing'];
  const attackByType: Record<DamageType, number> = { blunt: 0, slash: 0, piercing: 0 };
  for (const slot of ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const) {
    const profile = attackProfile(state, slot);
    if (profile) attackByType[profile.damageType] += profile.damage;
  }
  const defenseByType = Object.fromEntries(damageTypes.map((type) => [type, equippedDefense(state, type)])) as Record<DamageType, number>;
  return {
    totalAttack: damageTypes.reduce((total, type) => total + attackByType[type], 0),
    maxHp: maxHeroHp(state.stats),
    regenPerSecond: heroRegen(state.stats),
    attackByType,
    defenseByType
  };
}
