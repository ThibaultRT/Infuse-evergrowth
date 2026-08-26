import type { CombatAffinity, DamageType, EquipmentSlotId, LootType } from '../types';

export type GameEventMap = {
  enemyDamaged: { enemyId: string; amount: number; damageType: DamageType; itemId: string };
  weaponAttacked: { slot: import('../types').EquipmentSlotId; targetId: string; damageType: DamageType; itemId: string };
  enemyDefeated: { enemyId: string };
  enemyRespawned: { enemyId: string };
  bossDefeated: { bossId: string; areaId: number };
  heroDamaged: { amount: number; damageType: CombatAffinity; blocked: boolean };
  heroDefeated: undefined;
  heroResurrected: { areaId: number };
  gateUnlocked: { gateId: string };
  gateCrossed: { gateId: string; destinationAreaId: number };
  statGained: { sourceId: string; stat: LootType; amount: number };
  areaEntered: { areaId: number };
  equipmentDropped: { sourceId: string; areaId: number; itemId: string; quantity: number; previousLevel: number | null; newLevel: number; ascend: number };
  equipmentEquipped: { itemId: string; hand: EquipmentSlotId };
  equipmentUnequipped: { itemId: string; hand: EquipmentSlotId };
  weaponAscended: { itemId: string; previousAscend: number; newAscend: number };
  heroProgressReset: { equipment: boolean };
};

type Listener<T> = (event: T) => void;

/** Small synchronous dispatcher used to keep gameplay systems decoupled. */
export class GameEvents {
  private readonly listeners = new Map<keyof GameEventMap, Set<Listener<never>>>();

  on<K extends keyof GameEventMap>(type: K, listener: Listener<GameEventMap[K]>): () => void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as Listener<never>);
    this.listeners.set(type, listeners);
    return () => listeners.delete(listener as Listener<never>);
  }

  emit<K extends keyof GameEventMap>(type: K, event: GameEventMap[K]): void {
    this.listeners.get(type)?.forEach((listener) => listener(event as never));
  }
}
