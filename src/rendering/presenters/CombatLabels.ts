import * as THREE from 'three';
import { combatAffinityIcon, damageTypeIcon, evasionIcon, heartIcon, heartRegenIcon, shieldIcon, weaponClassIcon } from '../../icons';
import { EQUIPMENT_BY_ID } from '../../systems/EquipmentSystem';
import type { CombatAffinity, DamageType, LootType, WeaponSlotId } from '../../types';
import type { WorldUiManager } from '../WorldUiManager';

export function formatRewardAmount(amount: number): string {
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

export function lootIcon(type: LootType, size = 9): string {
  return type === 'regen' ? heartRegenIcon(size) : type === 'hp' ? heartIcon(size) : type === 'speed' ? '<span aria-label="Speed">SPD</span>' : damageTypeIcon(type, size);
}

export function showCombatText(worldUi: WorldUiManager, position: THREE.Vector3, amount: number, type: CombatAffinity | DamageType, incoming = false, blocked = false): void {
  const icon = blocked ? shieldIcon(11) : incoming ? combatAffinityIcon(type as CombatAffinity, 10) : damageTypeIcon(type as DamageType, 10);
  worldUi.addCombatText(position, `${blocked ? icon : ''}<span>${incoming ? '-' : ''}${Math.round(amount)}</span>${blocked ? '' : icon}`, incoming);
}

export function showEvadedCombatText(worldUi: WorldUiManager, position: THREE.Vector3): void {
  worldUi.addCombatText(position, `<span>Evaded</span>${evasionIcon(11)}`, true);
}

export function weaponCombatIcon(itemId: string): string {
  const item = EQUIPMENT_BY_ID.get(itemId);
  return item?.kind === 'weapon'
    ? `<span class="combat-weapon-icon rarity-${item.rarity}" aria-label="${item.name}">${weaponClassIcon(item.weaponClass, 10)}</span>`
    : damageTypeIcon('blunt', 10);
}

export const WEAPON_DAMAGE_TEXT_OFFSET: Record<WeaponSlotId, { x: number; y: number }> = {
  hand1: { x: 0, y: 0 },
  orbit1: { x: 72, y: 0 },
  orbit2: { x: 0, y: 20 },
  orbit3: { x: 72, y: 20 }
};
