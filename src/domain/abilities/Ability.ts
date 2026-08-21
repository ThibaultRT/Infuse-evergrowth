import type { DamageType } from '../../types';

export type AbilityTrigger = 'onAttack' | 'onHit' | 'onKill' | 'passive';
export type AbilityTarget = 'self' | 'target' | 'nearbyEnemies';

export type AbilityCondition =
  | { type: 'always' }
  | { type: 'damageType'; damageType: DamageType }
  | { type: 'healthBelow'; ratio: number };

export type AbilityEffect =
  | { type: 'addDamage'; amount: number; damageType: DamageType }
  | { type: 'multiplyDamage'; multiplier: number }
  | { type: 'heal'; amount: number }
  | { type: 'modifyAttackSpeed'; multiplier: number };

/**
 * Declarative ability definition inspired by Devour's condition/effect split.
 * Keep special item behavior here instead of adding item-specific branches to CombatSystem.
 */
export type AbilityDefinition = {
  id: string;
  trigger: AbilityTrigger;
  target: AbilityTarget;
  condition: AbilityCondition;
  effects: AbilityEffect[];
};

export type GrantedAbility = {
  abilityId: string;
  sourceId: string;
};
