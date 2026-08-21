import equipmentData from '../../data/equipment.json';
import type { EquipmentDefinition } from '../../types';

/** Static authored equipment definitions. Runtime ownership belongs to save/inventory state. */
export const EQUIPMENT = equipmentData as EquipmentDefinition[];
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((item) => [item.id, item]));

if (EQUIPMENT_BY_ID.size !== EQUIPMENT.length) throw new Error('Duplicate equipment ID');

export function equipmentById(itemId: string): EquipmentDefinition | undefined {
  return EQUIPMENT_BY_ID.get(itemId);
}
