import { heroDamage, save } from '../save';
import type { DamageType, EquipmentSlotId, OwnedEquipment } from '../types';
import { EQUIPMENT, EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';
import { ascendOwnedEquipment, canAscend, equipmentDamage } from '../domain/items/EquipmentProgression';

export { EQUIPMENT, EQUIPMENT_BY_ID, equipmentDamage };

export type AttackProfile = { damage: number; damageType: DamageType; cooldownSeconds: number };

/**
 * Runtime equipment orchestration. Static definitions and progression math live
 * in the item domain; this system only connects them to persistent player state.
 */
export function attackProfile(hand: EquipmentSlotId): AttackProfile {
  const itemId = save.inventory.equipped[hand];
  const item = itemId ? EQUIPMENT_BY_ID.get(itemId) : undefined;
  const owned = itemId ? save.inventory.items[itemId] : undefined;
  return item && owned
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

export function equip(itemId: string, hand: EquipmentSlotId): void {
  if (!save.inventory.items[itemId]) return;
  for (const slot of ['hand1', 'hand2', 'orbit1', 'orbit2'] as const) if (slot !== hand && save.inventory.equipped[slot] === itemId) save.inventory.equipped[slot] = null;
  save.inventory.equipped[hand] = itemId;
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
