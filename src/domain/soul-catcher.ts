import type { DamageType, SoulType } from '../types';

export type SoulEffect =
  | { type: 'maxHpAdditive' | 'regenAdditive' | 'speedRawAdditive' | 'criticalChanceRawAdditive' | 'criticalDamageRawAdditive'; amountPerLevel: number }
  | { type: 'attackAdditive' | 'defenceAdditive'; damageType: DamageType; amountPerLevel: number }
  | { type: 'soulDropAdditive'; soulType: SoulType; amountPerLevel: number }
  | { type: 'unlockSoulDrop'; soulType: SoulType };
export type SoulNode = { number: number; id: string; name: string; description: string; position: { angleDeg: number; radius: number }; maxLevel: number; cost: { soulType: SoulType; base: number; perLevel: number; formula: string }; reward: { effects: SoulEffect[]; display: string }; neighbors: string[] };
export type SoulLayer = { schemaVersion: number; layer: number; name: string; layout: { ringRadius: number }; nodes: SoulNode[] };
export function soulCost(node: SoulNode, targetLevel: number): number { return node.cost.base + node.cost.perLevel * (targetLevel - 1); }
