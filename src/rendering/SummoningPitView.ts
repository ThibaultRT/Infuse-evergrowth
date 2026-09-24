import * as THREE from 'three';
import { MINION_PIT } from '../data/world/minionPit';
import { loadPitModel } from './MinionAssets';
import { disposeOwnedObject } from './RenderingResourceDisposal';

export class SummoningPitView {
  readonly root = new THREE.Group();
  private readonly fallback = new THREE.Mesh(new THREE.TorusGeometry(MINION_PIT.diameter / 2 - .15, .15, 6, 24),
    new THREE.MeshStandardMaterial({ color: 0x847483, emissive: 0x39154b, roughness: .9 }));
  private disposed = false;
  readonly ready: Promise<void>;

  constructor() {
    this.root.name = MINION_PIT.name;
    this.root.position.set(MINION_PIT.x, MINION_PIT.y, MINION_PIT.z);
    this.root.rotation.y = MINION_PIT.rotation;
    this.fallback.rotation.x = -Math.PI / 2; this.fallback.position.y = .16;
    this.root.add(this.fallback);
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    try {
      const model = await loadPitModel();
      if (this.disposed) return;
      this.fallback.removeFromParent(); disposeOwnedObject(this.fallback); this.root.add(model);
    } catch (error) { if (!this.disposed) console.warn('Summoning Pit unavailable; keeping landmark fallback.', error); }
  }

  dispose(): void {
    this.disposed = true;
    if (this.fallback.parent) disposeOwnedObject(this.fallback);
    this.root.removeFromParent(); this.root.clear();
  }
}
