import balance from '../data/balance.json';
import lootTables from '../data/equipment-loot-tables.json';
import type { EquipmentRarity, Tier } from '../types';
import { EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';

type Table = { items?: string[]; inherits?: number; add?: string[] };
const tables = lootTables.areas as Record<string, Table>;

function poolForArea(areaId: number, seen = new Set<number>()): string[] {
  if (seen.has(areaId)) throw new Error('Equipment loot-table inheritance cycle');
  seen.add(areaId);
  const table = tables[String(areaId)];
  if (!table) return [];
  const items = table.items ?? (table.inherits ? poolForArea(table.inherits, seen) : []);
  return [...items, ...(table.add ?? [])];
}

export function rollEquipmentDrop(areaId: number, tier: Tier, rng = Math.random): string | null {
  if (tier === 'crystal' || tier === 'common') return null;
  const chances = balance.equipmentDrops.baseChanceByEnemyTier as Partial<Record<Tier, number>>;
  const multiplier = Math.min(1 + balance.equipmentDrops.areaChanceGrowth * (areaId - 1), balance.equipmentDrops.areaChanceMultiplierCap);
  if (rng() >= (chances[tier] ?? 0) * multiplier) return null;
  const pool = poolForArea(areaId).filter((id) => EQUIPMENT_BY_ID.has(id));
  const weights = balance.equipmentDrops.rarityWeightsByEnemyTier[tier] as Partial<Record<EquipmentRarity, number>>;
  const available = Object.entries(weights).filter(([rarity]) => pool.some((id) => EQUIPMENT_BY_ID.get(id)?.rarity === rarity));
  const total = available.reduce((sum, [, weight]) => sum + weight, 0);
  if (!total) return null;
  let roll = rng() * total;
  const rarity = available.find(([, weight]) => (roll -= weight) <= 0)?.[0] as EquipmentRarity | undefined;
  const candidates = pool.filter((id) => EQUIPMENT_BY_ID.get(id)?.rarity === rarity);
  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}
