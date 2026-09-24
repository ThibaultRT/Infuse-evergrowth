import type { GameEvents } from '../game/GameEvents';
import type { RuntimeHero } from '../game/GameplayRuntime';
import { applyEquipmentCopies } from './EquipmentSystem';
import type { AreaDefinition, SaveData, SpawnDefinition, WorldConnection } from '../types';
import { rollEquipmentDrop } from './EquipmentDropSystem';
import { RespawnSystem } from './RespawnSystem';
import { EQUIPMENT_BY_ID } from '../domain/items/EquipmentCatalog';
import { bossUnlockedConnections } from '../domain/world/GateUnlocks';
import { awardKillStat } from '../domain/stats/KillReward';
import type { CombatActorRef, SoulType } from '../types';
import type { MinionSystem } from './MinionSystem';

export type DefeatResult = {
  reward: { stat: import('../types').LootType; amount: number };
  drop: import('../game/GameEvents').GameEventMap['equipmentDropped'] | null;
  boss: { bossId: string; areaId: number; openedGateIds: string[] } | null;
  souls: { soulType: SoulType; quantity: number } | null;
};

/** Applies all persistent consequences of an enemy defeat without presentation dependencies. */
export class ProgressionSystem {
  private readonly respawns = new RespawnSystem();

  constructor(
    private readonly state: SaveData,
    private readonly events: GameEvents,
    private readonly persist: () => void,
    private readonly rng = Math.random,
    private readonly equipmentQuantity: (rarity: import('../types').EquipmentRarity) => number = () => 1,
    private readonly creditSouls: (definition: SpawnDefinition) => { soulType: SoulType; quantity: number } | null = () => null,
    private readonly minions: MinionSystem | null = null
  ) {}

  defeat(definition: SpawnDefinition, tier: import('../types').TierConfig, hero: RuntimeHero, areas: AreaDefinition[], gates: WorldConnection[], now: number, baseRespawnMs: number, nextResetMs: number, owner: CombatActorRef = { kind: 'hero' }): DefeatResult {
    const spawn = this.state.spawns[definition.id];
    const minion = owner.kind === 'minion' ? this.minions?.find(owner.minionId) : null;
    if (owner.kind === 'minion' && !minion) throw new Error(`Unknown defeat owner ${owner.minionId}`);
    if (spawn.respawnAt !== null) throw new Error(`Spawn ${definition.id} was defeated twice`);
    this.respawns.defeat(spawn, tier, now, baseRespawnMs, nextResetMs);
    const reward = spawn.roll.reward;
    const itemId = rollEquipmentDrop(definition.areaId, definition.tier, this.rng);
    let drop: DefeatResult['drop'] = null;
    const quantity = itemId ? this.equipmentQuantity(EQUIPMENT_BY_ID.get(itemId)!.rarity) : 0;
    const souls = this.creditSouls(definition);
    let minionDrop: ReturnType<MinionSystem['award']> = null;
    if (owner.kind === 'hero') {
      hero.hp = awardKillStat(this.state.stats, hero.hp, reward);
      if (itemId) {
        const { previousLevel, owned } = applyEquipmentCopies(this.state, itemId, quantity);
        drop = { sourceId: definition.id, areaId: definition.areaId, itemId, quantity, previousLevel, newLevel: owned.level, ascend: owned.ascend };
      }
    } else {
      minionDrop = this.minions!.award(owner.minionId, reward, itemId, quantity, souls);
    }

    const area = areas.find((candidate) => candidate.id === definition.areaId);
    let boss: DefeatResult['boss'] = null;
    if (definition.isBoss && area?.bossSpawnId === definition.id && !this.state.defeatedBosses.includes(definition.id)) {
      this.state.defeatedBosses.push(definition.id);
      const opened = bossUnlockedConnections(areas, gates, [definition.id]);
      for (const gate of opened) {
        if (!this.state.unlockedAreas.includes(gate.requiredUnlockedAreaId)) this.state.unlockedAreas.push(gate.requiredUnlockedAreaId);
      }
      boss = { bossId: definition.id, areaId: area.id, openedGateIds: opened.map((gate) => gate.id) };
    }
    this.state.heroHp = hero.hp;
    this.persist();
    this.events.emit('enemyDefeated', { enemyId: definition.id, owner });
    if (owner.kind === 'hero') {
      this.events.emit('statGained', { sourceId: definition.id, ...reward });
      if (drop) this.events.emit('equipmentDropped', drop);
    } else {
      this.events.emit('minionProgressed', { minionId: owner.minionId, sourceId: definition.id, ...reward, itemId, quantity,
        souls: souls ? { type: souls.soulType, quantity: souls.quantity } : null });
      if (itemId) this.events.emit('minionEquipmentChanged', { minionId: owner.minionId, itemId, slot: minionDrop?.slot ?? null });
    }
    if (souls) this.events.emit('soulDropped', { sourceId: definition.id, ...souls, owner });
    if (boss) { for (const gateId of boss.openedGateIds) this.events.emit('gateUnlocked', { gateId }); this.events.emit('bossDefeated', boss); }
    return { reward, drop, boss, souls };
  }
}
