import type { SoulNode } from '../../domain/soul-catcher';

const cost = (soulType: 'rare' | 'epic', base: number): SoulNode['cost'] => ({ soulType, base, perLevel: 0, formula: 'base + perLevel * (level - 1)' });

export const SOUL_BONUS_NODES: ReadonlyArray<{ layer: number; prerequisite: string; node: SoulNode }> = [
  { layer: 2, prerequisite: 'SC-31', node: { id: 'SC-MINION-02', name: 'Second Covenant', position: { angleDeg: 0, radius: 1.4 }, maxLevel: 1,
    cost: cost('rare', 40), reward: { effects: [{ type: 'unlockMinionSlot', slotId: 2 }], display: 'Permanently unlock minion slot 2 and summon its first Imp at no extra cost' }, neighbors: [] } },
  { layer: 3, prerequisite: 'SC-65', node: { id: 'SC-MINION-03', name: 'Third Covenant', position: { angleDeg: 125, radius: 1.5 }, maxLevel: 1,
    cost: cost('epic', 20), reward: { effects: [{ type: 'unlockMinionSlot', slotId: 3 }], display: 'Permanently unlock minion slot 3 and summon its first Imp at no extra cost' }, neighbors: [] } },
];
