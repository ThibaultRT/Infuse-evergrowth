import type { GameEvents } from './GameEvents';
import type { GameplayRuntime } from './GameplayRuntime';
import { ascend, equip, unequip } from '../systems/EquipmentSystem';
import { resetHeroProgress, resetPermanentStats } from '../persistence/SaveDefaults';
import { statTotal } from '../domain/stats/StatSources';
import type { EquipmentSlotId, MinionSlotId, SaveData } from '../types';
import type { SoulCatcherSystem } from '../systems/SoulCatcherSystem';
import type { MinionSystem } from '../systems/MinionSystem';
import { maxHeroHp } from '../systems/HeroStats';

export type GameCommand =
  | { type: 'move'; x: number; y: number }
  | { type: 'equip'; itemId: string; slot: EquipmentSlotId }
  | { type: 'unequip'; slot: EquipmentSlotId }
  | { type: 'ascend'; itemId: string }
  | { type: 'resetHero'; equipment: boolean }
  | { type: 'purchaseSoulNode'; nodeId: string }
  | { type: 'resetSoulCatcher' }
  | { type: 'summonMinion'; slotId: MinionSlotId }
  | { type: 'sacrificeMinion'; minionId: string }
  | { type: 'debugUnlockMinions' }
  | { type: 'enterArea'; areaId: number; connectionId: string };

/** Explicit command boundary for player-authored gameplay mutations. */
export class GameCommands {
  constructor(private readonly state: SaveData, private readonly runtime: GameplayRuntime, private readonly events: GameEvents, private readonly persist: () => void,
    private readonly soulCatcher: SoulCatcherSystem, private readonly minions: MinionSystem) {}

  movement(command: Extract<GameCommand, { type: 'move' }>): Readonly<{ x: number; y: number }> {
    return { x: command.x, y: command.y };
  }

  execute(command: Exclude<GameCommand, { type: 'move' }>): boolean {
    if (command.type === 'purchaseSoulNode') return this.soulCatcher.purchase(command.nodeId);
    if (command.type === 'resetSoulCatcher') { this.soulCatcher.reset(); return true; }
    if (command.type === 'debugUnlockMinions') {
      if (!import.meta.env.DEV) return false;
      const minion = this.minions.unlockSlot(1);
      if (!minion) return false;
      this.persist();
      this.events.emit('minionSlotUnlocked', { slotId: 1, minionId: minion.id });
      this.events.emit('minionSummoned', { minionId: minion.id, slotId: 1, paid: false });
      return true;
    }
    if (command.type === 'summonMinion') {
      const result = this.minions.paidSummon(command.slotId);
      if (!result) return false;
      this.persist();
      this.events.emit('minionSummoned', { minionId: result.minion.id, slotId: command.slotId, paid: true });
      return true;
    }
    if (command.type === 'sacrificeMinion') {
      const result = this.minions.sacrifice(command.minionId);
      if (!result) return false;
      this.runtime.hero.hp = Math.min(maxHeroHp(this.state.stats), this.runtime.hero.hp + result.infusion.stats.hp);
      this.persist();
      this.events.emit('minionInfused', { minionId: command.minionId, slotId: result.slotId, infusion: result.infusion });
      return true;
    }
    if (command.type === 'equip') { if (!equip(this.state, command.itemId, command.slot)) return false; this.events.emit('equipmentEquipped', { itemId: command.itemId, hand: command.slot }); }
    else if (command.type === 'unequip') { const itemId = unequip(this.state, command.slot); if (!itemId) return false; this.events.emit('equipmentUnequipped', { itemId, hand: command.slot }); }
    else if (command.type === 'ascend') { const previousAscend = this.state.inventory.items[command.itemId]?.ascend; if (previousAscend === undefined || !ascend(this.state, command.itemId)) return false; this.events.emit('weaponAscended', { itemId: command.itemId, previousAscend, newAscend: previousAscend + 1 }); }
    else if (command.type === 'resetHero') { command.equipment ? resetHeroProgress(this.state) : resetPermanentStats(this.state); this.events.emit('heroProgressReset', { equipment: command.equipment }); this.runtime.hero.hp = Math.min(this.runtime.hero.hp, statTotal(this.state.stats.maxHp)); }
    else { this.runtime.currentAreaId = command.areaId; this.state.currentAreaId = command.areaId; this.events.emit('gateCrossed', { gateId: command.connectionId, destinationAreaId: command.areaId }); this.events.emit('areaEntered', { areaId: command.areaId }); }
    this.persist();
    return true;
  }
}
