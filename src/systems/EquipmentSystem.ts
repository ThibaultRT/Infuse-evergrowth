import { heroDamage, save } from '../save';
import type { ArmorSlotId, DamageType, EquipmentSlotId, OwnedEquipment, WeaponSlotId } from '../types';
import { EQUIPMENT, EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';
import { ascendOwnedEquipment, canAscend, equipmentDamage, equipmentDefense } from '../domain/items/EquipmentProgression';

export { EQUIPMENT, EQUIPMENT_BY_ID, equipmentDamage, equipmentDefense };

export type AttackProfile = { damage: number; damageType: DamageType; cooldownSeconds: number };

/**
 * Runtime equipment orchestration. Static definitions and progression math live
 * in the item domain; this system only connects them to persistent player state.
 */
export function attackProfile(hand: WeaponSlotId): AttackProfile {
  const itemId = save.inventory.equipped[hand];
  const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
  const owned = itemId ? save.inventory.items[itemId] : undefined;
  return item?.kind === 'weapon' && owned
    ? { damage: equipmentDamage(item, owned) + heroDamage(item.damageType), damageType: item.damageType, cooldownSeconds: item.attackCooldownSeconds }
    : { damage: heroDamage('blunt'), damageType: 'blunt', cooldownSeconds: 1 };
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
  return (['helmet', 'armor', 'legs'] as const).reduce((total, slot) => {
    const itemId = save.inventory.equipped[slot];
    const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
    const owned = itemId ? save.inventory.items[itemId] : undefined;
    return total + (item?.damageType === type && owned ? equipmentDefense(item, owned) : 0);
  }, 0);
}
