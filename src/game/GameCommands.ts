import type { GameEvents } from './GameEvents';
import type { GameplayRuntime } from './GameplayRuntime';
import { ascend, equip, unequip } from '../systems/EquipmentSystem';
import { resetHeroProgress, resetPermanentStats, statTotal } from '../save';
import type { EquipmentSlotId, SaveData } from '../types';

export type GameCommand =
  | { type: 'move'; x: number; y: number }
  | { type: 'equip'; itemId: string; slot: EquipmentSlotId }
  | { type: 'unequip'; slot: EquipmentSlotId }
  | { type: 'ascend'; itemId: string }
  | { type: 'resetHero'; equipment: boolean }
  | { type: 'enterArea'; areaId: number; connectionId: string };

/** Explicit command boundary for player-authored gameplay mutations. */
export class GameCommands {
  constructor(private readonly state: SaveData, private readonly runtime: GameplayRuntime, private readonly events: GameEvents, private readonly persist: () => void) {}

  movement(command: Extract<GameCommand, { type: 'move' }>): Readonly<{ x: number; y: number }> {
    return { x: command.x, y: command.y };
  }

  execute(command: Exclude<GameCommand, { type: 'move' }>): boolean {
    if (command.type === 'equip') { if (!equip(command.itemId, command.slot)) return false; this.events.emit('equipmentEquipped', { itemId: command.itemId, hand: command.slot }); }
    else if (command.type === 'unequip') { const itemId = unequip(command.slot); if (!itemId) return false; this.events.emit('equipmentUnequipped', { itemId, hand: command.slot }); }
    else if (command.type === 'ascend') { const previousAscend = this.state.inventory.items[command.itemId]?.ascend; if (previousAscend === undefined || !ascend(command.itemId)) return false; this.events.emit('weaponAscended', { itemId: command.itemId, previousAscend, newAscend: previousAscend + 1 }); }
    else if (command.type === 'resetHero') { command.equipment ? resetHeroProgress() : resetPermanentStats(); this.runtime.hero.hp = Math.min(this.runtime.hero.hp, statTotal(this.state.stats.maxHp)); this.events.emit('heroProgressReset', { equipment: command.equipment }); }
    else { this.runtime.currentAreaId = command.areaId; this.state.currentAreaId = command.areaId; this.events.emit('gateCrossed', { gateId: command.connectionId, destinationAreaId: command.areaId }); this.events.emit('areaEntered', { areaId: command.areaId }); }
    this.persist();
    return true;
  }
}
