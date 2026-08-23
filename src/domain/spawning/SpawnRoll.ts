import type { NumberRange, SpawnDefinition, SpawnRoll } from '../../types';

function rollRange(range: NumberRange, random: () => number): number {
  return Math.floor(random() * (range.max - range.min + 1)) + range.min;
}

/** Rolls the combat stats and one allowed reward for a newly revived occupant. */
export function rollSpawn(definition: SpawnDefinition, random: () => number = Math.random): SpawnRoll {
  const reward = definition.rewards[Math.floor(random() * definition.rewards.length)];
  return {
    maxHp: rollRange(definition.hp, random),
    reward: { stat: reward.stat, amount: rollRange(reward, random) }
  };
}
