import * as THREE from 'three';
import { areaById, VISUAL_STREAMING } from '../config';
import { MINION_PIT } from '../data/world/minionPit';
import { worldWalkHeight } from '../domain/world/WorldWalkSurface';
import type { SavedMinion } from '../types';
import { MinionView } from './MinionView';
import { SummoningPitView } from './SummoningPitView';
import type { WorldUiManager } from './WorldUiManager';

/** Hero-centered residency controls views only; this class never advances simulation. */
export class MinionPresentation {
  private readonly views = new Map<string, MinionView>();
  private pit: SummoningPitView | null = null;

  constructor(private readonly scene: THREE.Scene, private readonly button: HTMLButtonElement,
    private readonly worldUi: WorldUiManager, private readonly mounted: (areaId: number) => boolean) {}

  update(dt: number, unlocked: boolean, roster: readonly SavedMinion[], hero: Readonly<{ x: number; z: number }>, moving: (id: string) => boolean): void {
    const pitVisible = unlocked && this.mounted(MINION_PIT.areaId);
    if (pitVisible && !this.pit) { this.pit = new SummoningPitView(); this.scene.add(this.pit.root); }
    if (!pitVisible && this.pit) { this.pit.dispose(); this.pit = null; }
    this.button.hidden = !this.pit;
    if (this.pit) this.worldUi.project(this.pit.root.position, this.button, MINION_PIT.labelHeight);
    const visible = new Set<string>();
    if (unlocked) for (const minion of roster) {
      const limit = this.views.has(minion.id) ? VISUAL_STREAMING.enemyDeactivateDistance : VISUAL_STREAMING.enemyActivateDistance;
      if (minion.respawnAt !== null || minion.hp <= 0 || !this.mounted(minion.areaId)
        || Math.hypot(minion.position.x - hero.x, minion.position.z - hero.z) > limit) continue;
      visible.add(minion.id);
      let view = this.views.get(minion.id);
      if (!view) { view = new MinionView(minion.color); view.root.name = `Minion_${minion.id}`; this.views.set(minion.id, view); this.scene.add(view.root); view.root.position.set(minion.position.x, 0, minion.position.z); }
      view.update(dt, { ...minion.position, y: worldWalkHeight(areaById(minion.areaId).walkSurfaces, minion.position) }, moving(minion.id));
    }
    for (const [id, view] of this.views) if (!visible.has(id)) { view.dispose(); this.views.delete(id); }
  }

  attack(id: string, target: Readonly<{ x: number; z: number }>): void { this.views.get(id)?.attack(target); }
  damaged(id: string): void { this.views.get(id)?.damaged(); }
  remove(id: string): void { this.views.get(id)?.dispose(); this.views.delete(id); }
}
