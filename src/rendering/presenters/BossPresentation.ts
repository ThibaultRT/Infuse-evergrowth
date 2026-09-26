import { areaById } from '../../config';
import { showBossProgression, showToast, ui } from '../../ui';
import { Lifetime } from '../../ui/Lifetime';
import type { SpawnPresentation } from './SpawnPresentation';
import type { GatePresentation } from './GatePresentation';
import type { InputController } from '../../controllers/InputController';
import type { CameraController } from '../../controllers/CameraController';
import type { EffectManager } from '../EffectManager';
import type { SoulCatcherSystem } from '../../systems/SoulCatcherSystem';

export class BossPresentation {
  private readonly lifetime = new Lifetime();
  constructor(private readonly context: { entities: SpawnPresentation[]; gates: GatePresentation[]; input: InputController; camera: CameraController; effects: EffectManager; souls: SoulCatcherSystem }) {}
  dispose(): void { this.lifetime.dispose(); }
  presentBossDefeat(result: { bossId: string; areaId: number; openedGateIds: string[] }): void {
    const bossEntity = this.context.entities.find((entity) => entity.def.id === result.bossId)!;
    bossEntity.setPresentationActive(true);
    this.context.effects.bossDefeat(bossEntity.spawnPosition);
    const openedGates = this.context.gates.filter((gate) => result.openedGateIds.includes(gate.def.id));
    for (const gate of openedGates) gate.setOpen(true);
    if (openedGates[0]) {
      this.context.input.reset();
      this.context.camera.focus(openedGates[0].position, 2600);
      const destination = areaById(openedGates[0].def.requiredUnlockedAreaId).name;
      this.context.effects.gateOpening(openedGates[0].position);
      showBossProgression(`${bossEntity.config.label} guardian`, destination);
    } else {
      showBossProgression(`${bossEntity.config.label} guardian`);
    }
    if (result.areaId === 2) this.lifetime.timeout(() => {
      ui.soulCatcherButton.classList.remove('locked');
      if (this.context.souls.announceUnlock(2)) { showToast('Soul Catcher unlocked!'); this.lifetime.timeout(() => showToast('Infuse souls of the defeated enemies and unlock powerful upgrades!'), 1600); }
      this.context.entities.forEach((entity) => entity.renderLoot());
    }, 3300);
  }

}
