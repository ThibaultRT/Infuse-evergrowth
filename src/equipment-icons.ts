import './equipment-icons.css';
import type { EquipmentDefinition, OwnedEquipment } from './types';

export type EquipmentIconVariant = 'bag' | 'slot' | 'detail';

export function equipmentProgressionNumber(owned: OwnedEquipment): number {
  return owned.ascend > 0 ? owned.ascend : owned.level;
}

export function hammerEquipmentIcon(item: EquipmentDefinition, owned: OwnedEquipment, variant: EquipmentIconVariant): string | null {
  if (item.kind !== 'weapon' || item.weaponClass !== 'hammer') return null;
  const progressLabel = owned.ascend > 0 ? `Ascend ${owned.ascend}` : `Level ${owned.level}`;
  return `<span class="hammer-equipment-icon hammer-rarity-${item.rarity} hammer-icon-${variant}" role="img" aria-label="${item.name}, ${progressLabel}"><span class="hammer-progress-number" aria-hidden="true">${equipmentProgressionNumber(owned)}</span></span>`;
}
