import * as THREE from 'three';
import type { WorldConnection } from '../../types';
import type { WorldChunkView } from '../environment/WorldBuilder';

export class GatePresentation {
  readonly position: THREE.Vector3;
  private view: WorldChunkView | null = null;
  open: boolean;

  constructor(readonly def: WorldConnection, unlockedAreas: readonly number[]) {
    this.position = new THREE.Vector3(def.x, 0, def.z);
    this.open = unlockedAreas.includes(def.requiredUnlockedAreaId);
  }

  attachView(view: WorldChunkView): void {
    this.view = view;
    view.setOpen(this.open);
  }

  detachView(view: WorldChunkView): void {
    if (this.view === view) this.view = null;
  }

  setOpen(value: boolean): void {
    this.open = value;
    this.view?.setOpen(value);
  }

  update(dt: number): void { this.view?.update(dt); }
}
