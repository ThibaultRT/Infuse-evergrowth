import type { SaveData, WeaponSlotId } from '../types';
import { attackProfile, ascendCopies, EQUIPMENT_BY_ID } from './EquipmentSystem';
import { maxHeroHp } from './HeroStatProjection';

export function createHudProjection(state: SaveData): {
  maxHp: number; attacks: { slot: WeaponSlotId; damage: number; damageType: import('../types').DamageType }[];
} {
  return { maxHp: maxHeroHp(state.stats), attacks: (['hand1', 'orbit1', 'orbit2', 'orbit3'] as const).flatMap((slot) => {
    const profile = attackProfile(state, slot);
    return profile ? [{ slot, damage: profile.damage, damageType: profile.damageType }] : [];
  }) };
}

export function equipmentDropCopiesRequired(itemId: string, ascend: number): number {
  return ascendCopies(EQUIPMENT_BY_ID.get(itemId)!, ascend);
}
