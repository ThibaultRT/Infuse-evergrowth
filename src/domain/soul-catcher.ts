import type { DamageType, SoulType } from '../types';

export type SoulEffect =
  | { type: 'maxHpAdditive' | 'regenAdditive' | 'speedRawAdditive' | 'criticalChanceRawAdditive' | 'criticalDamageRawAdditive' | 'blockChanceRawAdditive' | 'evasionChanceAdditive'; amountPerLevel: number }
  | { type: 'attackAdditive' | 'defenceAdditive'; damageType: DamageType; amountPerLevel: number }
  | { type: 'attackPercentAdditive' | 'damageResistancePercentAdditive'; damageType: DamageType; amountPerLevel: number }
  | { type: 'soulDropAdditive'; soulType: SoulType; amountPerLevel: number }
  | { type: 'unlockSoulDrop'; soulType: SoulType }
  | { type: 'enemyRespawnDivisor'; tier: 'uncommon'; divisorPerLevel: number }
  | { type: 'equipmentQuantityAdditive'; equipmentRarity: 'uncommon'; amountPerLevel: number }
  | { type: 'unlockMinions' };
export type SoulCost =
  | { soulType: SoulType; base: number; perLevel: number; formula: 'base + perLevel * (level - 1)' }
  | { soulType: SoulType; base: number; multiplier: number; formula: 'ceil(base * multiplier ** (level - 1))' };
export type SoulNode = { number?: number; id: string; name: string; position: { angleDeg: number; radius: number }; maxLevel: number; cost: SoulCost; reward: { effects: SoulEffect[]; display: string }; neighbors: string[] };
export type SoulLayer = { schemaVersion: number; layer: number; name: string; nodes: SoulNode[] };
export function soulCost(node: SoulNode, targetLevel: number): number {
  return node.cost.formula === 'ceil(base * multiplier ** (level - 1))'
    ? Math.ceil(node.cost.base * node.cost.multiplier ** (targetLevel - 1))
    : node.cost.base + node.cost.perLevel * (targetLevel - 1);
}
export const SOUL_XP_PER_SOUL: Record<SoulType, number> = { common: 1, uncommon: 3, rare: 80, epic: 500, legendary: 2500 };
export function soulPurchaseXp(type: SoulType, cost: number): number { return Math.max(0, cost) * SOUL_XP_PER_SOUL[type]; }
export function weightedLayerMaximum(layer: SoulLayer): number { return layer.nodes.reduce((sum, node) => { let cost = 0; for (let level = 1; level <= node.maxLevel; level += 1) cost += soulCost(node, level); return sum + soulPurchaseXp(node.cost.soulType, cost); }, 0); }
