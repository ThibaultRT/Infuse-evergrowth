import balance from '../../data/balance.json';
import type { EquipmentDefinition, OwnedEquipment } from '../../types';

export function ascendCopies(item: EquipmentDefinition, ascend = 0): number {
  if (item.kind === 'weapon') return balance.equipmentProgression.ascendCopiesByRarity[item.rarity];
  const { firstAscendCopies, copyGrowth } = balance.equipmentProgression.armorByRarity[item.rarity];
  return Math.round(firstAscendCopies * copyGrowth ** ascend / 10) * 10;
}

function growthAtAscend(item: EquipmentDefinition, ascend: number): number {
  if (item.kind !== 'weapon') return 0;
  return item.baseDamagePerLevel * balance.equipmentProgression.perLevelMultiplierPerAscend ** ascend;
}

function baseAtAscend(item: EquipmentDefinition, ascend: number): number {
  if (item.kind !== 'weapon') return 0;
  let base = item.baseDamage;
  for (let current = 0; current < ascend; current += 1) {
    base = balance.equipmentProgression.ascendBaseMultiplier * (base + (ascendCopies(item) - 1) * growthAtAscend(item, current));
  }
  return base;
}

/** Pure item-domain calculation: no save, renderer, UI, or world dependencies. */
export function equipmentDamage(item: EquipmentDefinition, owned: OwnedEquipment): number {
  if (item.kind !== 'weapon') return 0;
  return baseAtAscend(item, owned.ascend) + (owned.level - 1) * growthAtAscend(item, owned.ascend);
}

function armorBaseAtAscend(item: EquipmentDefinition, ascend: number): number {
  if (item.kind !== 'armor') return 0;
  const { baseDefense, defensePerCopy, ascendMultiplier } = balance.equipmentProgression.armorByRarity[item.rarity];
  let base = baseDefense;
  for (let current = 0; current < ascend; current += 1) {
    base = Math.round(ascendMultiplier * (base + (ascendCopies(item, current) - 1) * defensePerCopy));
  }
  return base;
}

/** Flat mitigation supplied by one armor item for its authored damage type. */
export function equipmentDefense(item: EquipmentDefinition, owned: OwnedEquipment): number {
  return item.kind === 'armor' ? armorBaseAtAscend(item, owned.ascend) + (owned.level - 1) * balance.equipmentProgression.armorByRarity[item.rarity].defensePerCopy : 0;
}

export function equipmentValuePerLevel(item: EquipmentDefinition, owned: OwnedEquipment): number {
  return item.kind === 'weapon' ? growthAtAscend(item, owned.ascend) : balance.equipmentProgression.armorByRarity[item.rarity].defensePerCopy;
}

export function equipmentAscendValue(item: EquipmentDefinition, owned: OwnedEquipment): number | null {
  if (!canAscend(item, owned)) return null;
  const ascended = ascendOwnedEquipment(item, owned);
  return item.kind === 'weapon' ? equipmentDamage(item, ascended) : equipmentDefense(item, ascended);
}

export function canAscend(item: EquipmentDefinition, owned: OwnedEquipment): boolean {
  return owned.level >= ascendCopies(item, owned.ascend);
}

export function ascendOwnedEquipment(item: EquipmentDefinition, owned: OwnedEquipment): OwnedEquipment {
  if (!canAscend(item, owned)) return owned;
  return {
    ...owned,
    // The threshold includes the retained item; only the other copies are consumed.
    level: owned.level - ascendCopies(item, owned.ascend) + 1,
    ascend: owned.ascend + 1
  };
}
