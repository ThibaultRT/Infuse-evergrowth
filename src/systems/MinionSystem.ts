import balance from '../data/balance.json';
import { MINION_PIT } from '../data/world/minionPit';
import { applyMinionDrop, calculateInfusion, createMinion, minionPitPosition, summonCost, type Infusion } from '../domain/minions';
import { awardKillStat } from '../domain/stats/KillReward';
import { statTotal } from '../domain/stats/StatSources';
import { EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';
import { equipmentDamage, equipmentDefense } from '../domain/items/EquipmentProgression';
import { applyEquipmentCopies, attackProfile, equippedDefense } from './EquipmentSystem';
import { heroBlockChance, heroCriticalChance, heroCriticalDamageMultiplier, heroEvasionChance, heroRegen, heroSpeed } from './HeroStats';
import type { DamageType, EquipmentSlotId, InventoryState, LootType, MinionSlotId, SaveData, SavedMinion, SoulType } from '../types';

export type MinionSummary = Readonly<{
  id: string; slotId: MinionSlotId; active: boolean; color: SavedMinion['color']; areaId: number; position: Readonly<{ x: number; z: number }>;
  hp: number; maxHp: number; respawnAt: number | null;
  stats: Readonly<{ regenPerSecond: number; speedMetersPerSecond: number; attackByType: Readonly<Record<DamageType, number>>;
    defenseByType: Readonly<Record<DamageType, number>>; criticalChancePercent: number; criticalDamageBonusPercent: number;
    blockChancePercent: number; evasionChancePercent: number }>;
  kills: Readonly<Record<LootType, number>>;
  equipment: Readonly<{ equipped: Readonly<InventoryState['equipped']>; items: ReadonlyArray<Readonly<{ itemId: string; level: number; ascend: number; value: number; earned: number }>> }>;
  soulContributions: Readonly<Record<SoulType, number>>;
}>;

/** Persistent roster lifecycle and owner-specific reward delivery. */
export class MinionSystem {
  constructor(private readonly state: SaveData, private readonly random: () => number) {}

  unlockSlot(slotId: MinionSlotId): SavedMinion | null {
    if (this.state.minions.unlockedSlots[slotId]) return null;
    this.state.minions.unlockedSlots[slotId] = true;
    if (this.state.minions.roster.some((entry) => entry.slotId === slotId)) return null;
    return this.addMinion(slotId);
  }

  private addMinion(slotId: MinionSlotId): SavedMinion {
    const id = `minion-${this.state.minions.nextSerial++}`;
    const minion = createMinion(id, slotId, this.random);
    this.state.minions.roster.push(minion);
    return minion;
  }

  paidSummon(slotId: MinionSlotId): { minion: SavedMinion; cost: number; soulType: SoulType } | null {
    const progression = this.state.minions;
    if (![1, 2, 3].includes(slotId)) return null;
    const { soulType, amount } = summonCost(slotId);
    if (!progression.unlockedSlots[slotId] || progression.roster.some((minion) => minion.slotId === slotId)
      || this.state.soulCatcher.balances[soulType] < amount) return null;
    this.state.soulCatcher.balances[soulType] -= amount;
    return { minion: this.addMinion(slotId), cost: amount, soulType };
  }

  sacrifice(minionId: string): { slotId: MinionSlotId; infusion: Infusion } | null {
    const index = this.state.minions.roster.findIndex((entry) => entry.id === minionId);
    if (index < 0) return null;
    const minion = this.state.minions.roster[index];
    const infusion = calculateInfusion([minion]);
    this.state.stats.maxHp.additive.minions += infusion.stats.hp;
    this.state.stats.regen.additive.minions += infusion.stats.regen;
    this.state.stats.speed.additive.minions += infusion.stats.speed;
    this.state.stats.evasion.raw.minions += infusion.stats.evasion;
    for (const type of ['blunt', 'slash', 'piercing'] as const) this.state.stats.attack[type].additive.minions += infusion.stats[type];
    for (const [itemId, quantity] of Object.entries(infusion.copies)) applyEquipmentCopies(this.state, itemId, quantity);
    // Runtime and save share this roster array; remove entries in place so enemy intent cannot retain sacrificed actors.
    this.state.minions.roster.splice(index, 1);
    return { slotId: minion.slotId, infusion };
  }

  find(id: string): SavedMinion | null { return this.state.minions.roster.find((entry) => entry.id === id) ?? null; }

  award(id: string, reward: { stat: LootType; amount: number }, itemId: string | null, quantity: number,
    souls: { soulType: SoulType; quantity: number } | null): { slot: EquipmentSlotId | null; previousLevel: number | null; newLevel: number; ascend: number } | null {
    const minion = this.find(id);
    if (!minion) return null;
    minion.hp = awardKillStat(minion.stats, minion.hp, reward);
    if (souls) minion.soulContributions[souls.soulType] += souls.quantity;
    if (!itemId || quantity <= 0) return null;
    const previousLevel = minion.inventory.items[itemId]?.level ?? null;
    const slot = applyMinionDrop(minion, itemId, quantity, this.state.unlockedAreas);
    const owned = minion.inventory.items[itemId];
    return { slot, previousLevel, newLevel: owned.level, ascend: owned.ascend };
  }

  kill(id: string, now: number): number | null {
    const minion = this.find(id);
    if (!minion || minion.respawnAt !== null) return null;
    minion.hp = 0;
    minion.respawnAt = now + balance.minions.respawnSeconds * 1000;
    return minion.respawnAt;
  }

  reviveDue(now: number): string[] {
    const revived: string[] = [];
    for (const minion of this.state.minions.roster) {
      if (minion.respawnAt === null || minion.respawnAt > now) continue;
      minion.respawnAt = null;
      minion.areaId = MINION_PIT.areaId;
      minion.position = minionPitPosition(minion.slotId);
      minion.hp = statTotal(minion.stats.maxHp);
      revived.push(minion.id);
    }
    return revived;
  }

  summaries(): MinionSummary[] {
    return this.state.minions.roster.map((minion) => {
      const types: DamageType[] = ['blunt', 'slash', 'piercing'];
      const attackByType: Record<DamageType, number> = { blunt: 0, slash: 0, piercing: 0 };
      for (const slot of ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const) {
        const profile = attackProfile(minion, slot);
        if (profile) attackByType[profile.damageType] += profile.damage;
      }
      if (!minion.inventory.equipped.hand1) attackByType.blunt += statTotal(minion.stats.attack.blunt);
      const defenseByType = Object.fromEntries(types.map((type) => [type, equippedDefense(minion, type)])) as Record<DamageType, number>;
      return {
      id: minion.id, slotId: minion.slotId, active: true, color: minion.color, areaId: minion.areaId, position: { ...minion.position }, hp: minion.hp,
      maxHp: statTotal(minion.stats.maxHp), respawnAt: minion.respawnAt,
      stats: { regenPerSecond: heroRegen(minion.stats), speedMetersPerSecond: heroSpeed(minion.stats), attackByType, defenseByType,
        criticalChancePercent: heroCriticalChance(minion.stats) * 100, criticalDamageBonusPercent: (heroCriticalDamageMultiplier(minion.stats) - 1) * 100,
        blockChancePercent: heroBlockChance(minion.stats) * 100, evasionChancePercent: heroEvasionChance(minion.stats) * 100 },
      kills: { hp: minion.stats.maxHp.additive.kills ?? 0, regen: minion.stats.regen.additive.kills ?? 0,
        speed: minion.stats.speed.additive.kills ?? 0, evasion: minion.stats.evasion.raw.kills,
        blunt: minion.stats.attack.blunt.additive.kills ?? 0, slash: minion.stats.attack.slash.additive.kills ?? 0,
        piercing: minion.stats.attack.piercing.additive.kills ?? 0 },
      equipment: { equipped: { ...minion.inventory.equipped }, items: Object.values(minion.inventory.items).map((owned) => {
        const definition = EQUIPMENT_BY_ID.get(owned.itemId)!;
        return { itemId: owned.itemId, level: owned.level, ascend: owned.ascend,
          value: definition.kind === 'weapon' ? equipmentDamage(definition, owned) : equipmentDefense(definition, owned),
          earned: minion.copiesEarned[owned.itemId] ?? 0 };
      }) },
      soulContributions: { ...minion.soulContributions }
      };
    });
  }
}
