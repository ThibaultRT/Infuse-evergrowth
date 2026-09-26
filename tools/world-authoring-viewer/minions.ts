import * as THREE from 'three';
import { MINION_PIT } from '../../src/data/world/minionPit';
import { createMinion } from '../../src/domain/minions';
import { MinionPresentation } from '../../src/rendering/MinionPresentation';
import { WorldUiManager } from '../../src/rendering/WorldUiManager';
import type { MinionSlotId } from '../../src/types';

/** Static authored snapshots only: no session, combat advancement, or save writes. */
export function minionPreview(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): () => void {
  const button = document.createElement('button');
  button.textContent = 'Manage minions'; button.disabled = true;
  button.style.cssText = 'position:absolute;transform:translate(-50%,-100%);min-height:44px;min-width:44px;padding:8px 12px;background:#222030;color:#f2dfff;border:1px solid #a183af;border-radius:12px;pointer-events:auto';
  document.body.append(button);
  const roster = [0, .4, .8].map((random, index) => {
    const minion = createMinion(`preview-${index}`, (index + 1) as MinionSlotId, () => random);
    minion.position = { x: MINION_PIT.x - 1.6 + index * 1.6, z: MINION_PIT.z + 2.5 };
    return minion;
  });
  let mode = 'locked';
  const presentation = new MinionPresentation(scene, button, new WorldUiManager(camera, renderer.domElement, document.body), () => mode !== 'remote');
  const update = (): void => presentation.update(0, mode !== 'locked', roster, MINION_PIT, () => false);
  Object.assign(window, { __MINIONS_PREVIEW__: (next: string) => {
    mode = next;
    for (const minion of roster) { minion.respawnAt = next === 'dead' ? 1000 : null; minion.hp = next === 'dead' ? 0 : 20; }
    renderer.setPixelRatio(next === 'reduced' ? .7 : 1);
    update();
    return { pit: !!scene.getObjectByName(MINION_PIT.name), minions: scene.children.filter((child) => child.name.startsWith('Minion_')).length, buttonHidden: button.hidden };
  } });
  return update;
}
