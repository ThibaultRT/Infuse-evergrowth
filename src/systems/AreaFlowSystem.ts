import type { AreaDefinition, GateDefinition } from '../types';

/** Owns area-entry and gate-progression decisions; views only present the result. */
export class AreaFlowSystem {
  canEnter(areaId: number, unlockedAreas: number[]): boolean { return unlockedAreas.includes(areaId); }

  unlockBossGates(areaId: number, gates: GateDefinition[], unlockedAreas: number[]): GateDefinition[] {
    const opened = gates.filter((gate) => gate.sourceAreaId === areaId && gate.requiresBossDefeated);
    for (const gate of opened) if (!unlockedAreas.includes(gate.targetAreaId)) unlockedAreas.push(gate.targetAreaId);
    return opened;
  }

  crossesAdjacentBoundary(previous: AreaDefinition, next: AreaDefinition): boolean {
    return previous.id !== next.id && Math.abs(previous.originZ - next.originZ) <= 60 && previous.originX === next.originX;
  }
}
