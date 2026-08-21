import balance from '../../data/balance.json';
import type { EquipmentDefinition, OwnedEquipment } from '../../types';

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

/** Pure item-domain calculation: no save, renderer, UI, or world dependencies. */
export function equipmentDamage(item: EquipmentDefinition, owned: OwnedEquipment): number {
  return baseAtAscend(item, owned.ascend) + (owned.level - 1) * growthAtAscend(item, owned.ascend);
}

export function canAscend(owned: OwnedEquipment): boolean {
  return owned.level >= balance.equipmentProgression.ascendLevel;
}

export function ascendOwnedEquipment(owned: OwnedEquipment): OwnedEquipment {
  if (!canAscend(owned)) return owned;
  return {
    ...owned,
    level: Math.max(1, owned.level - balance.equipmentProgression.ascendLevel),
    ascend: owned.ascend + 1
  };
}
