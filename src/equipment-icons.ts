import './equipment-icons.css';
import type { EquipmentDefinition, OwnedEquipment } from './types';

export type EquipmentIconVariant = 'bag' | 'slot' | 'detail';

const EQUIPMENT_ICON_URLS = import.meta.glob<string>('./assets/ui/equipment/*.svg', { eager: true, query: '?url', import: 'default' });

export function equipmentProgressionNumber(owned: OwnedEquipment): number {
  return owned.ascend > 0 ? owned.ascend : owned.level;
}

export function equipmentIcon(item: EquipmentDefinition, owned: OwnedEquipment, variant: EquipmentIconVariant): string | null {
  const progressLabel = owned.ascend > 0 ? `Ascend ${owned.ascend}` : `Level ${owned.level}`;
  const iconName = item.kind === 'weapon'
    ? `${item.weaponClass}-${item.rarity}`
    : `${item.armorClass === 'boots' ? 'legs' : item.armorClass}-${item.damageType}-${item.rarity}`;
  const iconUrl = EQUIPMENT_ICON_URLS[`./assets/ui/equipment/${iconName}.svg`];
  if (!iconUrl) return null;
  return `<span class="equipment-icon equipment-icon-${variant}" role="img" aria-label="${item.name}, ${progressLabel}" style="--equipment-icon: url('${iconUrl}')"><span class="equipment-progress-number" aria-hidden="true">${equipmentProgressionNumber(owned)}</span></span>`;
}
