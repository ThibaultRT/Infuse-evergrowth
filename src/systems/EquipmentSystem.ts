import { heroDamage, heroRegen, maxHeroHp, save } from '../save';
import type { ArmorSlotId, DamageType, EquipmentSlotId, OwnedEquipment, WeaponSlotId } from '../types';
import { EQUIPMENT, EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';
import { ascendOwnedEquipment, canAscend, equipmentAscendValue, equipmentDamage, equipmentDefense, equipmentValuePerLevel } from '../domain/items/EquipmentProgression';

export { EQUIPMENT, EQUIPMENT_BY_ID, equipmentAscendValue, equipmentDamage, equipmentDefense, equipmentValuePerLevel };

export type AttackProfile = { itemId: string; damage: number; damageType: DamageType; cooldownSeconds: number };
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
export function attackProfile(hand: WeaponSlotId): AttackProfile | null {
  const itemId = save.inventory.equipped[hand];
  const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
  const owned = itemId ? save.inventory.items[itemId] : undefined;
  return item?.kind === 'weapon' && owned
    ? { itemId: item.id, damage: equipmentDamage(item, owned) + heroDamage(item.damageType), damageType: item.damageType, cooldownSeconds: item.attackCooldownSeconds }
    : null;
}

export function applyEquipmentCopies(itemId: string, quantity: number): { previousLevel: number | null; owned: OwnedEquipment } {
  const previous = save.inventory.items[itemId];
  const owned = previous ?? { itemId, level: 0, ascend: 0 };
  const previousLevel = previous?.level ?? null;
  owned.level += quantity;
  save.inventory.items[itemId] = owned;
  return { previousLevel, owned };
}

const ARMOR_SLOT: Record<'helmet' | 'armor' | 'boots', ArmorSlotId> = { helmet: 'helmet', armor: 'armor', boots: 'legs' };

export function equipmentSlot(itemId: string): EquipmentSlotId | null {
  const item = EQUIPMENT_BY_ID.get(itemId);
  return item?.kind === 'armor' ? ARMOR_SLOT[item.armorClass] : null;
}

export function equip(itemId: string, slot: EquipmentSlotId): void {
  const item = EQUIPMENT_BY_ID.get(itemId);
  if (!save.inventory.items[itemId] || !item) return;
  const armorSlot = item.kind === 'armor' ? ARMOR_SLOT[item.armorClass] : null;
  if ((armorSlot && slot !== armorSlot) || (!armorSlot && !['hand1', 'hand2', 'orbit1', 'orbit2'].includes(slot))) return;
  for (const other of Object.keys(save.inventory.equipped) as EquipmentSlotId[]) if (other !== slot && save.inventory.equipped[other] === itemId) save.inventory.equipped[other] = null;
  save.inventory.equipped[slot] = itemId;
}

export function unequip(hand: EquipmentSlotId): string | null {
  const itemId = save.inventory.equipped[hand];
  save.inventory.equipped[hand] = null;
  return itemId;
}

export function ascend(itemId: string): boolean {
  const owned = save.inventory.items[itemId];
  if (!owned || !canAscend(owned)) return false;
  save.inventory.items[itemId] = ascendOwnedEquipment(owned);
  return true;
}

export function equippedDefense(type: DamageType): number {
  return save.stats.defense[type].additive.soulCatcher + (['helmet', 'armor', 'legs'] as const).reduce((total, slot) => {
    const itemId = save.inventory.equipped[slot];
    const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    const owned = itemId ? save.inventory.items[itemId] : undefined;
    return total + (item?.damageType === type && owned ? equipmentDefense(item, owned) : 0);
  }, 0);
}

/** Plain-value projection of the authoritative equipment and hero stat rules used by combat. */
export function equipmentCombatSummary(): InventoryCombatSummary {
  const damageTypes: DamageType[] = ['blunt', 'slash', 'piercing'];
  const attackByType: Record<DamageType, number> = { blunt: 0, slash: 0, piercing: 0 };
  for (const slot of ['hand1', 'hand2', 'orbit1', 'orbit2'] as const) {
    const profile = attackProfile(slot);
    if (profile) attackByType[profile.damageType] += profile.damage;
  }
  const defenseByType = Object.fromEntries(damageTypes.map((type) => [type, equippedDefense(type)])) as Record<DamageType, number>;
  return {
    totalAttack: damageTypes.reduce((total, type) => total + attackByType[type], 0),
    maxHp: maxHeroHp(),
    regenPerSecond: heroRegen(),
    attackByType,
    defenseByType
  };
}
