import balance from '../../data/balance.json';
import type { EquipmentDefinition, EquipmentRarity, OwnedEquipment } from '../../types';

export function ascendCopies(rarity: EquipmentRarity): number {
  return balance.equipmentProgression.ascendCopiesByRarity[rarity];
}

function growthAtAscend(item: EquipmentDefinition, ascend: number): number {
  if (item.kind !== 'weapon') return 0;
  return item.baseDamagePerLevel * balance.equipmentProgression.perLevelMultiplierPerAscend ** ascend;
}

function baseAtAscend(item: EquipmentDefinition, ascend: number): number {
  if (item.kind !== 'weapon') return 0;
  let base = item.baseDamage;
  for (let current = 0; current < ascend; current += 1) {
    base = balance.equipmentProgression.ascendBaseMultiplier * (base + (ascendCopies(item.rarity) - 1) * growthAtAscend(item, current));
  }
  return base;
}

/** Pure item-domain calculation: no save, renderer, UI, or world dependencies. */
export function equipmentDamage(item: EquipmentDefinition, owned: OwnedEquipment): number {
  if (item.kind !== 'weapon') return 0;
  return baseAtAscend(item, owned.ascend) + (owned.level - 1) * growthAtAscend(item, owned.ascend);
}

/** Flat mitigation supplied by one armor item for its authored damage type. */
export function equipmentDefense(item: EquipmentDefinition, owned: OwnedEquipment): number {
  return item.kind === 'armor' ? owned.level * item.baseDefensePerLevel * 2 ** owned.ascend : 0;
}

export function equipmentValuePerLevel(item: EquipmentDefinition, owned: OwnedEquipment): number {
  return item.kind === 'weapon' ? growthAtAscend(item, owned.ascend) : item.baseDefensePerLevel * 2 ** owned.ascend;
}

export function equipmentAscendValue(item: EquipmentDefinition, owned: OwnedEquipment): number | null {
  if (!canAscend(item, owned)) return null;
  const ascended = ascendOwnedEquipment(item, owned);
  return item.kind === 'weapon' ? equipmentDamage(item, ascended) : equipmentDefense(item, ascended);
}

export function canAscend(item: EquipmentDefinition, owned: OwnedEquipment): boolean {
  return owned.level >= ascendCopies(item.rarity);
}

export function ascendOwnedEquipment(item: EquipmentDefinition, owned: OwnedEquipment): OwnedEquipment {
  if (!canAscend(item, owned)) return owned;
  return {
    ...owned,
    level: Math.max(1, owned.level - ascendCopies(item.rarity)),
    ascend: owned.ascend + 1
  };
}
