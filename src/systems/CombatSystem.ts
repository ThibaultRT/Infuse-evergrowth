import { affinityDamage } from '../domain/combat/Affinity';
import type { CombatAffinity, DamageType, WeaponSlotId } from '../types';

export type CombatTarget = {
  alive: boolean;
  weakness: CombatAffinity | null;
  distanceToHero(): number;
};

/** Owns combat scheduling and renderer-independent damage resolution. */
export class CombatSystem {
  private readonly cooldowns: Record<WeaponSlotId, number>;

  constructor(initialCooldowns: Partial<Record<WeaponSlotId, number>> = {}) {
    this.cooldowns = { hand1: 0, hand2: 0, orbit1: 0, orbit2: 0, ...initialCooldowns };
  }

  update(dt: number): void {
    for (const slot of Object.keys(this.cooldowns) as WeaponSlotId[]) this.cooldowns[slot] = Math.max(0, this.cooldowns[slot] - dt);
  }

  ready(slot: WeaponSlotId): boolean { return this.cooldowns[slot] === 0; }
  schedule(slot: WeaponSlotId, cooldownSeconds: number): void { this.cooldowns[slot] = cooldownSeconds; }

  nearestTarget<T extends CombatTarget>(targets: T[], maxDistance: number): T | null {
    let best: T | null = null;
    let distance = maxDistance;
    for (const target of targets) {
      if (!target.alive) continue;
      const candidate = target.distanceToHero();
      if (candidate < distance) { best = target; distance = candidate; }
    }
    return best;
  }

  heroAttackDamage(amount: number, type: DamageType, weakness: CombatAffinity | null): number {
    return affinityDamage(amount, type, weakness);
  }

  enemyAttackDamage(amount: number, type: CombatAffinity, defense: (type: DamageType) => number): number {
    const damageType: DamageType = type === 'pierce' ? 'piercing' : type;
    return Math.max(0, amount - defense(damageType));
  }
}
