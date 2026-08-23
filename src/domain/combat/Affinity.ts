import balance from '../../data/balance.json';
import type { CombatAffinity, DamageType } from '../../types';

export type AffinityAttackType = CombatAffinity | DamageType;

const weaknessByArmor: Record<CombatAffinity, CombatAffinity> = {
  blunt: 'pierce',
  slash: 'blunt',
  pierce: 'slash'
};

const resistanceByWeakness: Record<CombatAffinity, CombatAffinity> = {
  blunt: 'slash',
  slash: 'pierce',
  pierce: 'blunt'
};

function normalizeAffinity(type: AffinityAttackType): CombatAffinity {
  return type === 'piercing' ? 'pierce' : type;
}

/** Returns the attack affinity that deals bonus damage to a given armor type. */
export function armorWeakness(armor: CombatAffinity): CombatAffinity {
  return weaknessByArmor[armor];
}

/** Applies the cyclic weak/strong relationship; null means an affinity-neutral defender. */
export function affinityDamage(baseDamage: number, attack: AffinityAttackType, weakness: CombatAffinity | null): number {
  if (weakness === null) return baseDamage;
  const affinity = normalizeAffinity(attack);
  if (affinity === weakness) return baseDamage * balance.affinities.weakDamageMultiplier;
  if (affinity === resistanceByWeakness[weakness]) return baseDamage * balance.affinities.strongDamageMultiplier;
  return baseDamage;
}
