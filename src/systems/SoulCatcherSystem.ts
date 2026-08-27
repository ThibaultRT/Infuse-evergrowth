import { SOUL_EDGES, SOUL_NODE_BY_ID, SOUL_NODES } from '../data/soul-catcher';
import { soulCost, type SoulEffect } from '../domain/soul-catcher';
import type { GameEvents } from '../game/GameEvents';
import { statTotal } from '../save';
import type { DamageType, SaveData, SoulType, SpawnDefinition } from '../types';

const AREA_TWO_BOSS_ID = 'area2-rare-01';

/** Owns persistent Soul balances, graph progression and effect projection. */
export class SoulCatcherSystem {
  constructor(private readonly state: SaveData, private readonly events: GameEvents, private readonly persist: () => void) { this.projectEffects(); }

  get available(): boolean { return this.state.defeatedBosses.includes(AREA_TWO_BOSS_ID); }
  level(nodeId: string): number { return this.state.soulCatcher.nodeLevels[nodeId] ?? 0; }
  revealed(nodeId: string): boolean {
    if (nodeId === 'SC-01' || this.level(nodeId) > 0) return true;
    return SOUL_EDGES.some(([a, b]) => (a === nodeId && this.level(b) > 0) || (b === nodeId && this.level(a) > 0));
  }
  yieldFor(definition: SpawnDefinition): { soulType: SoulType; quantity: number } | null {
    if (!this.available || definition.tier === 'crystal' || !this.isEligible(definition.tier)) return null;
    const soulType = definition.tier as SoulType;
    return { soulType, quantity: 1 + this.effectTotal('soulDropAdditive', soulType) };
  }
  grant(definition: SpawnDefinition): { soulType: SoulType; quantity: number } | null {
    const drop = this.yieldFor(definition);
    if (!drop) return null;
    this.state.soulCatcher.balances[drop.soulType] += drop.quantity;
    this.events.emit('soulDropped', { sourceId: definition.id, ...drop });
    this.persist();
    return drop;
  }
  purchase(nodeId: string): boolean {
    const node = SOUL_NODE_BY_ID.get(nodeId);
    if (!this.available || !node || !this.revealed(nodeId)) return false;
    const previousLevel = this.level(nodeId);
    if (previousLevel >= node.maxLevel) return false;
    const cost = soulCost(node, previousLevel + 1);
    if (this.state.soulCatcher.balances[node.cost.soulType] < cost) return false;
    this.state.soulCatcher.balances[node.cost.soulType] -= cost;
    this.state.soulCatcher.nodeLevels[nodeId] = previousLevel + 1;
    this.projectEffects();
    this.events.emit('soulNodePurchased', { nodeId, previousLevel, newLevel: previousLevel + 1, soulType: node.cost.soulType, cost });
    this.persist();
    return true;
  }
  reset(): void {
    Object.keys(this.state.soulCatcher.balances).forEach((key) => { this.state.soulCatcher.balances[key as SoulType] = 0; });
    this.state.soulCatcher.nodeLevels = {};
    this.projectEffects();
    this.events.emit('soulCatcherReset', undefined);
    this.persist();
  }
  announceUnlock(areaId = 2): boolean {
    if (!this.available || this.state.soulCatcher.unlockAnnouncementSeen) return false;
    this.state.soulCatcher.unlockAnnouncementSeen = true;
    this.events.emit('soulCatcherUnlocked', { areaId }); this.persist(); return true;
  }
  defense(type: DamageType): number { return statTotal(this.state.stats.defense[type]); }
  syncEffects(): void { this.projectEffects(); }
  private isEligible(type: string): boolean { return type === 'common' || (type === 'uncommon' && this.level('SC-20') > 0); }
  private effectTotal(type: SoulEffect['type'], soulType?: SoulType): number {
    return SOUL_NODES.reduce((sum, node) => sum + node.reward.effects.reduce((effectSum, effect) => effect.type === type && (!soulType || !('soulType' in effect) || effect.soulType === soulType) ? effectSum + ('amountPerLevel' in effect ? effect.amountPerLevel * this.level(node.id) : 0) : effectSum, 0), 0);
  }
  private projectEffects(): void {
    const clear = (): void => {
      for (const stat of [this.state.stats.maxHp, this.state.stats.regen, this.state.stats.speed, this.state.stats.criticalChance, this.state.stats.criticalDamage, ...Object.values(this.state.stats.attack), ...Object.values(this.state.stats.defense)]) stat.additive.soulCatcher = 0;
    };
    clear();
    for (const node of SOUL_NODES) for (const effect of node.reward.effects) this.apply(effect, this.level(node.id));
  }
  private apply(effect: SoulEffect, level: number): void {
    if (!('amountPerLevel' in effect)) return;
    const value = effect.amountPerLevel * level;
    const stat = effect.type === 'maxHpAdditive' ? this.state.stats.maxHp : effect.type === 'regenAdditive' ? this.state.stats.regen : effect.type === 'speedRawAdditive' ? this.state.stats.speed : effect.type === 'criticalChanceRawAdditive' ? this.state.stats.criticalChance : effect.type === 'criticalDamageRawAdditive' ? this.state.stats.criticalDamage : effect.type === 'attackAdditive' ? this.state.stats.attack[effect.damageType] : effect.type === 'defenceAdditive' ? this.state.stats.defense[effect.damageType] : null;
    if (stat) stat.additive.soulCatcher += value;
  }
}
