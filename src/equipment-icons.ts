import './equipment-icons.css';
import type { EquipmentDefinition, OwnedEquipment } from './types';

export type EquipmentIconVariant = 'bag' | 'slot' | 'detail';

const WEAPON_ICON_URLS = import.meta.glob<string>('./assets/ui/equipment/*.svg', { eager: true, query: '?url', import: 'default' });

export function equipmentProgressionNumber(owned: OwnedEquipment): number {
  return owned.ascend > 0 ? owned.ascend : owned.level;
}

export function weaponEquipmentIcon(item: EquipmentDefinition, owned: OwnedEquipment, variant: EquipmentIconVariant): string | null {
  if (item.kind !== 'weapon') return null;
  const progressLabel = owned.ascend > 0 ? `Ascend ${owned.ascend}` : `Level ${owned.level}`;
  const iconUrl = WEAPON_ICON_URLS[`./assets/ui/equipment/${item.weaponClass}-${item.rarity}.svg`];
  if (!iconUrl) return null;
  return `<span class="weapon-equipment-icon weapon-icon-${variant}" role="img" aria-label="${item.name}, ${progressLabel}" style="--weapon-icon: url('${iconUrl}')"><span class="weapon-progress-number" aria-hidden="true">${equipmentProgressionNumber(owned)}</span></span>`;
}
