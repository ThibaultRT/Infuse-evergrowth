import * as THREE from 'three';
import { loadMinionModel } from './MinionAssets';
import { disposeClonedSkeletons, disposeOwnedObject } from './RenderingResourceDisposal';
import type { MinionColorVariant } from '../types';

/** Cosmetic motion fallback: the supplied Imp has a skeleton but no animation clips. */
export class MinionView {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly fallback: THREE.Mesh;
  private disposed = false;
  private age = 0;
  private pulse = 0;
  private hit = false;
  private readonly limbs: { bone: THREE.Object3D; rest: THREE.Quaternion; phase: number; arm: boolean }[] = [];
  private readonly swing = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3(1, 0, 0);
  readonly ready: Promise<void>;

  constructor(color: MinionColorVariant) {
    this.fallback = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .65, 4, 8),
      new THREE.MeshStandardMaterial({ color: { 'variant-1': 0xbf4942, 'variant-2': 0x86aa4d, 'variant-3': 0x667ac9 }[color] }));
    this.fallback.position.y = .65;
    this.body.add(this.fallback); this.root.add(this.body);
    this.ready = this.load(color);
  }

  private async load(color: MinionColorVariant): Promise<void> {
    try {
      const model = await loadMinionModel(color);
      if (this.disposed) { disposeClonedSkeletons(model); return; }
      // Modest rest-pose correction for the unanimated source T-pose. Keep all
      // transforms per clone, never change cached skeletons or gameplay values.
      model.updateMatrixWorld(true);
      for (const side of ['l', 'r']) {
        const arm = model.getObjectByName(`upperarm_${side}`), hand = model.getObjectByName(`hand_${side}`);
        if (arm?.parent && hand) {
          const direction = hand.getWorldPosition(new THREE.Vector3()).sub(arm.getWorldPosition(new THREE.Vector3())).normalize();
          const down = new THREE.Vector3(Math.sign(direction.x) * .3, -.95, .05).normalize();
          const parent = arm.parent.getWorldQuaternion(new THREE.Quaternion());
          const correction = parent.clone().invert().multiply(new THREE.Quaternion().setFromUnitVectors(direction, down)).multiply(parent);
          arm.quaternion.premultiply(correction); model.updateMatrixWorld(true);
          this.limbs.push({ bone: arm, rest: arm.quaternion.clone(), phase: side === 'l' ? 1 : -1, arm: true });
        }
        const leg = model.getObjectByName(`thigh_${side}`);
        if (leg) this.limbs.push({ bone: leg, rest: leg.quaternion.clone(), phase: side === 'l' ? -1 : 1, arm: false });
      }
      this.fallback.removeFromParent(); disposeOwnedObject(this.fallback);
      this.body.add(model);
    } catch (error) { if (!this.disposed) console.warn('Imp unavailable; keeping minion fallback.', error); }
  }

  attack(target: Readonly<{ x: number; z: number }>): void {
    this.root.rotation.y = Math.atan2(target.x - this.root.position.x, target.z - this.root.position.z);
    this.pulse = .3; this.hit = false;
  }
  damaged(): void { this.pulse = .2; this.hit = true; }

  update(dt: number, position: Readonly<{ x: number; y: number; z: number }>, moving: boolean): void {
    const dx = position.x - this.root.position.x, dz = position.z - this.root.position.z;
    if (moving && dx * dx + dz * dz > .000001) this.root.rotation.y = Math.atan2(dx, dz);
    this.root.position.copy(position);
    this.age += dt; this.pulse = Math.max(0, this.pulse - dt);
    this.body.position.y = moving ? Math.abs(Math.sin(this.age * 10)) * .08 : Math.sin(this.age * 2) * .015;
    this.body.rotation.x = this.pulse ? Math.sin(this.pulse * Math.PI / .3) * (this.hit ? -.15 : .25) : 0;
    for (const limb of this.limbs) {
      const angle = moving ? Math.sin(this.age * 10) * .3 * limb.phase : limb.arm && this.pulse && !this.hit ? -.5 * Math.sin(this.pulse * Math.PI / .3) : 0;
      limb.bone.quaternion.copy(limb.rest).multiply(this.swing.setFromAxisAngle(this.axis, angle));
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.fallback.parent) disposeOwnedObject(this.fallback);
    disposeClonedSkeletons(this.body); this.root.removeFromParent(); this.root.clear();
  }
}
