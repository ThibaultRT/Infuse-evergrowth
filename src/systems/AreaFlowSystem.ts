import type { WorldConnection } from '../types';

/** Owns area-entry and gate-progression decisions; views only present the result. */
export class AreaFlowSystem {
  unlockBossGates(areaId: number, gates: WorldConnection[], unlockedAreas: number[]): WorldConnection[] {
    const opened = gates.filter((gate) => gate.unlockOnBossOfAreaId === areaId);
    for (const gate of opened) if (!unlockedAreas.includes(gate.requiredUnlockedAreaId)) unlockedAreas.push(gate.requiredUnlockedAreaId);
    return opened;
  }
}
