import type { EquipmentSlotId, SoulType } from '../../types';
export function sourceLabel(source: string): string { return source.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase()); }

export const soulIcon = (type: SoulType): string => `<span class="soul-icon soul-${type}" aria-hidden="true"></span>`;


export const SLOT_LABELS: Record<EquipmentSlotId, string> = { hand1: 'Weapon', orbit1: 'Orbit 1', orbit2: 'Orbit 2', orbit3: 'Orbit 3', helmet: 'Helmet', armor: 'Armor', legs: 'Legs', ring: 'Ring' };
