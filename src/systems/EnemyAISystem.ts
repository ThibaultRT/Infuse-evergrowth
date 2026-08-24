export type EnemyAIState = {
  provoked: boolean;
  attackCooldown: number;
};

export type EnemyAIIntent = 'idle' | 'chase' | 'return' | 'attack';

/** Resolves hostile movement/attack intent without owning a rendered enemy. */
export class EnemyAISystem {
  constructor(
    private readonly aggroRadius: number,
    private readonly leashRadius: number,
    private readonly attackRange: number,
    private readonly positioningRange: number
  ) {}

  update(state: EnemyAIState, distanceToHero: number, distanceFromSpawn: number, dt: number): EnemyAIIntent {
    state.attackCooldown = Math.max(0, state.attackCooldown - dt);
    if (!state.provoked && distanceToHero <= this.aggroRadius && distanceFromSpawn < this.leashRadius) state.provoked = true;
    if (state.provoked && distanceFromSpawn >= this.leashRadius) state.provoked = false;
    if (!state.provoked) return distanceFromSpawn > .08 ? 'return' : 'idle';
    if (distanceToHero > this.attackRange) return 'chase';
    if (state.attackCooldown === 0) return 'attack';
    // Keep closing during cooldown until the hero is comfortably inside retaliation range.
    return distanceToHero > this.positioningRange ? 'chase' : 'idle';
  }
}
