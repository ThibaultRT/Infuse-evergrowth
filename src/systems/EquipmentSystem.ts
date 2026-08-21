import balance from '../data/balance.json';
import equipmentData from '../data/equipment.json';
import { heroDamage, save } from '../save';
import type { DamageType, EquipmentDefinition, HandSlotId, OwnedEquipment } from '../types';

export const EQUIPMENT = equipmentData as EquipmentDefinition[];
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((item) => [item.id, item]));
if (EQUIPMENT_BY_ID.size !== EQUIPMENT.length) throw new Error('Duplicate equipment ID');

export type AttackProfile = { damage: number; damageType: DamageType; cooldownSeconds: number };

function growthAtAscend(item: EquipmentDefinition, ascend: number): number {
  return item.baseDamagePerLevel * balance.equipmentProgression.perLevelMultiplierPerAscend ** ascend;
}

function baseAtAscend(item: EquipmentDefinition, ascend: number): number {
  let base = item.baseDamage;
  for (let current = 0; current < ascend; current += 1) {
    base = balance.equipmentProgression.ascendBaseMultiplier * (base + (balance.equipmentProgression.ascendLevel - 1) * growthAtAscend(item, current));
  }
  return base;
}

export function equipmentDamage(item: EquipmentDefinition, owned: OwnedEquipment): number {
  return baseAtAscend(item, owned.ascend) + (owned.level - 1) * growthAtAscend(item, owned.ascend);
}

export function attackProfile(hand: HandSlotId): AttackProfile {
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

export function equip(itemId: string, hand: HandSlotId): void {
  if (!save.inventory.items[itemId]) return;
  const other: HandSlotId = hand === 'hand1' ? 'hand2' : 'hand1';
  if (save.inventory.equipped[other] === itemId) save.inventory.equipped[other] = null;
  save.inventory.equipped[hand] = itemId;
}

export function unequip(hand: HandSlotId): string | null {
  const itemId = save.inventory.equipped[hand];
  save.inventory.equipped[hand] = null;
  return itemId;
}

export function ascend(itemId: string): boolean {
  const owned = save.inventory.items[itemId];
  if (!owned || owned.level < balance.equipmentProgression.ascendLevel) return false;
  owned.level = Math.max(1, owned.level - balance.equipmentProgression.ascendLevel);
  owned.ascend += 1;
  return true;
}
