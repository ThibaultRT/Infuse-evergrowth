import type { CombatAffinity, CombatActorRef, DamageType, EquipmentSlotId, LootType, SoulType } from '../types';
import type { Infusion } from '../domain/minions';

export type GameEventMap = {
  enemyDamaged: { enemyId: string; owner: CombatActorRef; amount: number; damageType: DamageType; itemId: string; slot: import('../types').WeaponSlotId };
  weaponAttacked: { slot: import('../types').EquipmentSlotId; targetId: string; damageType: DamageType; itemId: string };
  enemyDefeated: { enemyId: string; owner?: CombatActorRef };
  enemyRespawned: { enemyId: string };
  bossDefeated: { bossId: string; areaId: number; openedGateIds: string[] };
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
  soulCatcherUnlocked: { areaId: number };
  soulDropped: { sourceId: string; soulType: SoulType; quantity: number; owner?: CombatActorRef };
  soulNodePurchased: { nodeId: string; previousLevel: number; newLevel: number; soulType: SoulType; cost: number };
  soulCatcherReset: undefined;
  soulCatcherXpGained: { amount: number; total: number };
  soulCatcherLayerUnlocked: { layer: number };
  heroEvaded: { damageType: CombatAffinity };
  dailyReset: undefined;
  minionsUnlocked: { minionId: string };
  minionSummoned: { minionId: string; paid: boolean };
  minionDamaged: { minionId: string; amount: number; blocked: boolean };
  minionDefeated: { minionId: string; respawnAt: number };
  minionRespawned: { minionId: string };
  minionEquipmentChanged: { minionId: string; itemId: string; slot: EquipmentSlotId | null };
  minionProgressed: { minionId: string; sourceId: string; stat: LootType; amount: number; itemId: string | null; quantity: number; souls: { type: SoulType; quantity: number } | null };
  minionsInfused: { minionIds: string[]; infusion: Infusion };
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
