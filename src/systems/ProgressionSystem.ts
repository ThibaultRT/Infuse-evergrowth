import type { GameEvents } from '../game/GameEvents';
import type { RuntimeHero } from '../game/GameplayRuntime';
import { statTotal } from '../save';
import type { AreaDefinition, SaveData, SpawnDefinition, WorldConnection } from '../types';
import { rollEquipmentDrop } from './EquipmentDropSystem';
import { RespawnSystem } from './RespawnSystem';
import { EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';

export type DefeatResult = {
  reward: { stat: import('../types').LootType; amount: number };
  drop: import('../game/GameEvents').GameEventMap['equipmentDropped'] | null;
  boss: { bossId: string; areaId: number; openedGateIds: string[] } | null;
};

/** Applies all persistent consequences of an enemy defeat without presentation dependencies. */
export class ProgressionSystem {
  private readonly respawns = new RespawnSystem();

  constructor(
    private readonly state: SaveData,
    private readonly events: GameEvents,
    private readonly persist: () => void,
    private readonly rng = Math.random,
    private readonly equipmentQuantity: (rarity: import('../types').EquipmentRarity) => number = () => 1
  ) {}

  defeat(definition: SpawnDefinition, tier: import('../types').TierConfig, hero: RuntimeHero, areas: AreaDefinition[], gates: WorldConnection[], now: number, baseRespawnMs: number, nextResetMs: number): DefeatResult {
    const spawn = this.state.spawns[definition.id];
    this.respawns.defeat(spawn, tier, now, baseRespawnMs, nextResetMs);
    const reward = spawn.roll.reward;
    if (reward.stat === 'hp') {
      const oldMax = statTotal(this.state.stats.maxHp);
      this.state.stats.maxHp.additive.kills = (this.state.stats.maxHp.additive.kills ?? 0) + reward.amount;
      hero.hp = Math.min(statTotal(this.state.stats.maxHp), hero.hp + statTotal(this.state.stats.maxHp) - oldMax);
    } else if (reward.stat === 'regen') this.state.stats.regen.additive.kills = (this.state.stats.regen.additive.kills ?? 0) + reward.amount;
    else if (reward.stat === 'evasion') this.state.stats.evasion.raw.kills += reward.amount;
    else this.state.stats.attack[reward.stat].additive.kills = (this.state.stats.attack[reward.stat].additive.kills ?? 0) + reward.amount;
    this.events.emit('enemyDefeated', { enemyId: definition.id });
    this.events.emit('statGained', { sourceId: definition.id, ...reward });

    const itemId = rollEquipmentDrop(definition.areaId, definition.tier, this.rng);
    let drop: DefeatResult['drop'] = null;
    if (itemId) {
      const quantity = this.equipmentQuantity(EQUIPMENT_BY_ID.get(itemId)!.rarity);
      const previous = this.state.inventory.items[itemId];
      const owned = previous ?? { itemId, level: 0, ascend: 0 };
      const previousLevel = previous?.level ?? null;
      owned.level += quantity;
      this.state.inventory.items[itemId] = owned;
      drop = { sourceId: definition.id, areaId: definition.areaId, itemId, quantity, previousLevel, newLevel: owned.level, ascend: owned.ascend };
      this.events.emit('equipmentDropped', drop);
    }

    const area = areas.find((candidate) => candidate.id === definition.areaId);
    let boss: DefeatResult['boss'] = null;
    if (definition.isBoss && area?.bossSpawnId === definition.id && !this.state.defeatedBosses.includes(definition.id)) {
      this.state.defeatedBosses.push(definition.id);
      const opened = gates.filter((gate) => gate.unlockOnBossOfAreaId === area.id);
      for (const gate of opened) {
        if (!this.state.unlockedAreas.includes(gate.requiredUnlockedAreaId)) this.state.unlockedAreas.push(gate.requiredUnlockedAreaId);
        this.events.emit('gateUnlocked', { gateId: gate.id });
      }
      boss = { bossId: definition.id, areaId: area.id, openedGateIds: opened.map((gate) => gate.id) };
      this.events.emit('bossDefeated', { bossId: definition.id, areaId: area.id });
    }
    this.state.heroHp = hero.hp;
    this.persist();
    return { reward, drop, boss };
  }
}
