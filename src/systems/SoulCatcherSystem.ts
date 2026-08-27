import { SOUL_LAYER_REGISTRY, SOUL_NODE_BY_ID, SOUL_NODES, soulEdges } from '../data/soul-catcher';
import { soulCost, soulPurchaseXp, type SoulEffect } from '../domain/soul-catcher';
import type { GameEvents } from '../game/GameEvents';
import { statTotal } from '../save';
import type { DamageType, EquipmentRarity, SaveData, SoulType, SpawnDefinition, Tier } from '../types';

const AREA_TWO_BOSS_ID = 'area2-rare-01';
export class SoulCatcherSystem {
  constructor(private readonly state: SaveData, private readonly events: GameEvents, private readonly persist: () => void) { this.projectEffects(); }
  get available(): boolean { return this.state.defeatedBosses.includes(AREA_TWO_BOSS_ID); }
  level(nodeId: string): number { return this.state.soulCatcher.nodeLevels[nodeId] ?? 0; }
  layerUnlocked(layer: number): boolean { return layer <= this.state.soulCatcher.highestUnlockedLayer; }
  revealed(nodeId: string): boolean {
    const node = SOUL_NODE_BY_ID.get(nodeId); if (!node) return false;
    const layer = SOUL_LAYERS_FOR_NODE(nodeId); if (!this.layerUnlocked(layer)) return false;
    if (node.number === (layer - 1) * 30 + 1 || this.level(nodeId) > 0) return true;
    return soulEdges(layer).some(([a, b]) => (a === nodeId && this.level(b) > 0) || (b === nodeId && this.level(a) > 0));
  }
  canPurchase(nodeId: string): boolean { const node = SOUL_NODE_BY_ID.get(nodeId); if (!this.available || !node || !this.revealed(nodeId)) return false; const level = this.level(nodeId); return level < node.maxLevel && this.state.soulCatcher.balances[node.cost.soulType] >= soulCost(node, level + 1); }
  yieldFor(definition: SpawnDefinition): { soulType: SoulType; quantity: number } | null { if (!this.available || definition.tier === 'crystal' || !this.soulDropUnlocked(definition.tier)) return null; const soulType = definition.tier as SoulType; return { soulType, quantity: 1 + this.effectTotal('soulDropAdditive', (effect) => 'soulType' in effect && effect.soulType === soulType) }; }
  grant(definition: SpawnDefinition): { soulType: SoulType; quantity: number } | null { const drop = this.yieldFor(definition); if (!drop) return null; this.state.soulCatcher.balances[drop.soulType] += drop.quantity; this.events.emit('soulDropped', { sourceId: definition.id, ...drop }); this.persist(); return drop; }
  purchase(nodeId: string): boolean {
    const node = SOUL_NODE_BY_ID.get(nodeId); if (!node || !this.canPurchase(nodeId)) return false;
    const previousLevel = this.level(nodeId), cost = soulCost(node, previousLevel + 1), gained = soulPurchaseXp(node.cost.soulType, cost);
    this.state.soulCatcher.balances[node.cost.soulType] -= cost; this.state.soulCatcher.nodeLevels[nodeId] = previousLevel + 1; this.state.soulCatcher.xp += gained;
    const previousLayer = this.state.soulCatcher.highestUnlockedLayer;
    this.state.soulCatcher.highestUnlockedLayer = SOUL_LAYER_REGISTRY.reduce((highest, metadata) => metadata.unlockXp !== null && this.state.soulCatcher.xp >= metadata.unlockXp ? metadata.layer : highest, 1);
    this.projectEffects(); this.events.emit('soulNodePurchased', { nodeId, previousLevel, newLevel: previousLevel + 1, soulType: node.cost.soulType, cost }); this.events.emit('soulCatcherXpGained', { amount: gained, total: this.state.soulCatcher.xp });
    for (let layer = previousLayer + 1; layer <= this.state.soulCatcher.highestUnlockedLayer; layer += 1) this.events.emit('soulCatcherLayerUnlocked', { layer });
    this.persist(); return true;
  }
  reset(): void { for (const type of Object.keys(this.state.soulCatcher.balances) as SoulType[]) this.state.soulCatcher.balances[type] = 0; this.state.soulCatcher.nodeLevels = {}; this.state.soulCatcher.xp = 0; this.state.soulCatcher.highestUnlockedLayer = 1; this.projectEffects(); this.events.emit('soulCatcherReset', undefined); this.persist(); }
  announceUnlock(areaId = 2): boolean { if (!this.available || this.state.soulCatcher.unlockAnnouncementSeen) return false; this.state.soulCatcher.unlockAnnouncementSeen = true; this.events.emit('soulCatcherUnlocked', { areaId }); this.persist(); return true; }
  defense(type: DamageType): number { return statTotal(this.state.stats.defense[type]); }
  resistance(type: DamageType): number { return Math.max(0, Math.min(1, statTotal(this.state.stats.damageResistance[type]))); }
  respawnDivisor(tier: Tier): number { return tier === 'uncommon' ? Math.max(1, this.effectTotal('enemyRespawnDivisor', (effect) => 'tier' in effect && effect.tier === tier, true)) : 1; }
  equipmentQuantity(rarity: EquipmentRarity): number { return 1 + this.effectTotal('equipmentQuantityAdditive', (effect) => 'equipmentRarity' in effect && effect.equipmentRarity === rarity); }
  soulYield(type: SoulType): { unlocked: boolean; base: number; additional: number } { return { unlocked: this.soulDropUnlocked(type), base: this.soulDropUnlocked(type) ? 1 : 0, additional: this.effectTotal('soulDropAdditive', (effect) => 'soulType' in effect && effect.soulType === type) }; }
  syncEffects(): void { this.projectEffects(); }
  private soulDropUnlocked(type: string): boolean { return type === 'common' || SOUL_NODES.some((node) => this.level(node.id) > 0 && node.reward.effects.some((effect) => effect.type === 'unlockSoulDrop' && effect.soulType === type)); }
  private effectTotal(type: SoulEffect['type'], matches: (effect: SoulEffect) => boolean = () => true, multiply = false): number { let total = multiply ? 1 : 0; for (const node of SOUL_NODES) for (const effect of node.reward.effects) if (effect.type === type && matches(effect)) { const value = 'amountPerLevel' in effect ? effect.amountPerLevel * this.level(node.id) : 'divisorPerLevel' in effect ? effect.divisorPerLevel ** this.level(node.id) : 0; total = multiply ? total * value : total + value; } return total; }
  private projectEffects(): void {
    for (const stat of [this.state.stats.maxHp, this.state.stats.regen, this.state.stats.speed, this.state.stats.criticalChance, this.state.stats.criticalDamage, this.state.stats.blockChance, ...Object.values(this.state.stats.attack), ...Object.values(this.state.stats.defense), ...Object.values(this.state.stats.damageResistance)]) { stat.additive.soulCatcher = 0; if ('soulCatcher' in stat.multiplicative) delete stat.multiplicative.soulCatcher; }
    this.state.stats.evasion.directChance.soulCatcher = 0;
    for (const node of SOUL_NODES) for (const effect of node.reward.effects) this.apply(effect, this.level(node.id));
  }
  private apply(effect: SoulEffect, level: number): void {
    if (!('amountPerLevel' in effect)) return; const value = effect.amountPerLevel * level;
    if (effect.type === 'evasionChanceAdditive') { this.state.stats.evasion.directChance.soulCatcher += value; return; }
    if (effect.type === 'attackPercentAdditive') { this.state.stats.attack[effect.damageType].multiplicative.soulCatcher = 1 + value; return; }
    const stat = effect.type === 'damageResistancePercentAdditive' ? this.state.stats.damageResistance[effect.damageType] : effect.type === 'maxHpAdditive' ? this.state.stats.maxHp : effect.type === 'regenAdditive' ? this.state.stats.regen : effect.type === 'speedRawAdditive' ? this.state.stats.speed : effect.type === 'criticalChanceRawAdditive' ? this.state.stats.criticalChance : effect.type === 'criticalDamageRawAdditive' ? this.state.stats.criticalDamage : effect.type === 'blockChanceRawAdditive' ? this.state.stats.blockChance : effect.type === 'attackAdditive' ? this.state.stats.attack[effect.damageType] : effect.type === 'defenceAdditive' ? this.state.stats.defense[effect.damageType] : null;
    if (stat) stat.additive.soulCatcher += value;
  }
}
function SOUL_LAYERS_FOR_NODE(nodeId: string): number { const node = SOUL_NODE_BY_ID.get(nodeId); return node ? Math.ceil(node.number / 30) : 0; }
