import { SOUL_LAYER_REGISTRY, soulEdges, soulLayer } from '../data/soul-catcher';
import balance from '../data/balance.json';
import { soulCost } from '../domain/soul-catcher';
import { statAdditiveTotal, statTotal } from '../domain/stats/StatSources';
import type { DamageType, EquipmentDefinition, EquipmentSlotId, OwnedEquipment, SaveData, SoulType, StatSources, WeaponSlotId } from '../types';
import { EQUIPMENT_BY_ID, ascendCopies, attackProfile, defenseSources, equipmentAscendValue, equipmentCombatSummary, equipmentDamage, equipmentDefense, equipmentSlot, equipmentSlotUnlocked, equipmentValuePerLevel, type InventoryCombatSummary } from './EquipmentSystem';
import { heroBlockChance, heroCriticalChance, heroCriticalDamageMultiplier, heroEvasionChance, heroRawEvasionChance, heroSpeed, heroSpeedMultiplier } from './HeroStats';
import type { SoulCatcherSystem } from './SoulCatcherSystem';
import { calculateInfusion, nextSummonCost, type Infusion } from '../domain/minions';
import type { MinionSummary, MinionSystem } from './MinionSystem';

type ReadonlyValues<T> = { readonly [K in keyof T]: T[K] extends object ? ReadonlyValues<T[K]> : T[K] };
export type StatSnapshot = ReadonlyValues<StatSources & { additiveTotal: number; total: number }>;
export type EquipmentSnapshot = ReadonlyValues<{
  definition: EquipmentDefinition;
  owned: OwnedEquipment;
  equippedSlot: EquipmentSlotId | null;
  value: number;
  perLevel: number;
  ascend: { value: number | null; copiesRequired: number; copiesRemaining: number; available: boolean };
  equipSlots: { slot: EquipmentSlotId; itemId: string | null }[];
  autoEquipSlot: EquipmentSlotId | null;
}>;
export type SoulNodeSnapshot = ReadonlyValues<{
  id: string; name: string; position: { angleDeg: number; radius: number }; description: string;
  soulType: SoulType; level: number; maxLevel: number; nextCost: number | null; revealed: boolean; purchasable: boolean;
}>;
export type ProgressionSnapshot = ReadonlyValues<{
  stats: {
    maxHp: StatSnapshot; regen: StatSnapshot;
    attack: Record<DamageType, StatSnapshot>; defense: Record<DamageType, StatSnapshot>; damageResistance: Record<DamageType, StatSnapshot>;
    attacks: { slot: WeaponSlotId; itemId: string; damageType: DamageType; damage: number; cooldownSeconds: number; sources: StatSnapshot }[];
    speed: StatSnapshot & { multiplier: number; metersPerSecond: number };
    criticalChance: StatSnapshot & { percent: number }; criticalDamage: StatSnapshot & { bonusPercent: number }; blockChance: StatSnapshot & { percent: number };
    evasion: { raw: Record<string, number>; directChance: Record<string, number>; rawChance: number; total: number };
  };
  equipment: {
    summary: InventoryCombatSummary;
    slots: { slot: EquipmentSlotId; itemId: string | null; unlocked: boolean }[];
    items: Record<string, EquipmentSnapshot>;
  };
  soulCatcher: {
    available: boolean; balances: Record<SoulType, number>; xp: number; nextLayerXp: number | null; progressPercent: number;
    yields: { type: SoulType; unlocked: boolean; base: number; additional: number; total: number }[];
    layers: { layer: number; name: string; authored: boolean; unlocked: boolean; nodes: SoulNodeSnapshot[]; edges: [string, string][] }[];
  };
  minions: { unlockedEver: boolean; paidSummonCount: number; nextSummonCost: number; activeCapacity: number; roster: MinionSummary[]; infusionPreview: Infusion };
}>;

const WEAPON_SLOTS = ['hand1', 'orbit1', 'orbit2', 'orbit3'] as const;
const EQUIPMENT_SLOTS = [...WEAPON_SLOTS, 'helmet', 'armor', 'legs', 'ring'] as const;
const SOUL_TYPES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;

function statSnapshot(stat: StatSources): StatSnapshot {
  return { base: stat.base, additive: { ...stat.additive }, multiplicative: { ...stat.multiplicative }, additiveTotal: statAdditiveTotal(stat), total: statTotal(stat) };
}

function typedStats(project: (type: DamageType) => StatSnapshot): Record<DamageType, StatSnapshot> {
  return { blunt: project('blunt'), slash: project('slash'), piercing: project('piercing') };
}

/** Detached, read-only presentation values. Build on demand, never in the frame loop.
 * All rules remain in their existing systems/domain; no save state or callbacks escape.
 */
export function createProgressionSnapshot(state: SaveData, souls: SoulCatcherSystem, minions?: MinionSystem): ProgressionSnapshot {
  const { stats, inventory, soulCatcher } = state;
  const slots = EQUIPMENT_SLOTS.map((slot) => ({ slot, itemId: inventory.equipped[slot], unlocked: equipmentSlotUnlocked(state, slot) }));
  const items: Record<string, EquipmentSnapshot> = {};
  for (const owned of Object.values(inventory.items)) {
    const definition = EQUIPMENT_BY_ID.get(owned.itemId);
    if (!definition) continue;
    const armorSlot = equipmentSlot(definition.id);
    const equipSlots = slots.filter(({ slot, unlocked }) => unlocked && (armorSlot ? slot === armorSlot : WEAPON_SLOTS.some((weaponSlot) => slot === weaponSlot))).map(({ slot, itemId }) => ({ slot, itemId }));
    const freeSlots = equipSlots.filter(({ itemId }) => itemId === null);
    const copiesRequired = ascendCopies(definition, owned.ascend), ascendValue = equipmentAscendValue(definition, owned);
    items[owned.itemId] = {
      definition: { ...definition }, owned: { ...owned }, equippedSlot: slots.find(({ itemId }) => itemId === owned.itemId)?.slot ?? null,
      value: definition.kind === 'weapon' ? equipmentDamage(definition, owned) : equipmentDefense(definition, owned),
      perLevel: equipmentValuePerLevel(definition, owned),
      ascend: { value: ascendValue, copiesRequired, copiesRemaining: Math.max(0, copiesRequired - owned.level), available: ascendValue !== null },
      equipSlots, autoEquipSlot: armorSlot ?? (freeSlots.length === 1 ? freeSlots[0].slot : null),
    };
  }
  const nextLayerXp = SOUL_LAYER_REGISTRY.find(({ layer }) => layer === soulCatcher.highestUnlockedLayer + 1)?.unlockXp ?? null;
  const previousLayerXp = SOUL_LAYER_REGISTRY.find(({ layer }) => layer === soulCatcher.highestUnlockedLayer)?.unlockXp ?? 0;
  return {
    stats: {
      maxHp: statSnapshot(stats.maxHp), regen: statSnapshot(stats.regen),
      attack: typedStats((type) => statSnapshot(stats.attack[type])), defense: typedStats((type) => statSnapshot(defenseSources(state, type))),
      damageResistance: typedStats((type) => statSnapshot(stats.damageResistance[type])),
      attacks: WEAPON_SLOTS.flatMap((slot) => { const profile = attackProfile(state, slot); return profile ? [{ slot, ...profile, sources: statSnapshot(profile.sources) }] : []; }),
      speed: { ...statSnapshot(stats.speed), multiplier: heroSpeedMultiplier(stats), metersPerSecond: heroSpeed(stats) },
      criticalChance: { ...statSnapshot(stats.criticalChance), percent: heroCriticalChance(stats) * 100 },
      criticalDamage: { ...statSnapshot(stats.criticalDamage), bonusPercent: (heroCriticalDamageMultiplier(stats) - 1) * 100 },
      blockChance: { ...statSnapshot(stats.blockChance), percent: heroBlockChance(stats) * 100 },
      evasion: { raw: { ...stats.evasion.raw }, directChance: { ...stats.evasion.directChance }, rawChance: heroRawEvasionChance(stats), total: heroEvasionChance(stats) },
    },
    equipment: { summary: equipmentCombatSummary(state), slots, items },
    soulCatcher: {
      available: souls.available, balances: { ...soulCatcher.balances }, xp: soulCatcher.xp, nextLayerXp,
      progressPercent: nextLayerXp === null ? 100 : Math.max(0, Math.min(100, (soulCatcher.xp - previousLayerXp) / Math.max(1, nextLayerXp - previousLayerXp) * 100)),
      yields: SOUL_TYPES.map((type) => ({ type, ...souls.soulYield(type) })),
      layers: SOUL_LAYER_REGISTRY.map((metadata) => ({
        layer: metadata.layer, name: metadata.name, authored: metadata.authored, unlocked: souls.layerUnlocked(metadata.layer),
        edges: soulEdges(metadata.layer).map(([a, b]) => [a, b]),
        nodes: (soulLayer(metadata.layer)?.nodes ?? []).map((node) => {
          const level = souls.level(node.id);
          const repeatedUnlock = node.reward.effects.some((effect) => effect.type === 'unlockMinions') && state.minions.unlockedEver;
          return { id: node.id, name: node.name, position: { ...node.position },
            description: repeatedUnlock ? 'Minions are already permanently unlocked. A repeat purchase grants Soul Catcher XP only.' : node.reward.display,
            soulType: node.cost.soulType,
            level, maxLevel: node.maxLevel, nextCost: level >= node.maxLevel ? null : soulCost(node, level + 1), revealed: souls.revealed(node.id), purchasable: souls.canPurchase(node.id) };
        }),
      })),
    },
    minions: { unlockedEver: state.minions.unlockedEver, paidSummonCount: state.minions.paidSummonCount,
      nextSummonCost: nextSummonCost(state.minions.paidSummonCount), activeCapacity: balance.minions.activeCapacity,
      roster: minions?.summaries() ?? [], infusionPreview: calculateInfusion(state.minions.roster) },
  };
}
