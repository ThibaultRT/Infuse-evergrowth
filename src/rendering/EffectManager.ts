import * as THREE from 'three';
import type { DamageType } from '../types';

type Effect = { root: THREE.Object3D; age: number; duration: number; velocity: THREE.Vector3 };

/** Small capped pool for cosmetic combat and resurrection feedback. */
export class EffectManager {
  private readonly effects: Effect[] = [];
  constructor(private readonly scene: THREE.Scene, private readonly cap = 28) {}

  impact(position: THREE.Vector3, type: DamageType): void {
    const color = type === 'blunt' ? 0xc7b58c : type === 'slash' ? 0xc8e9ff : 0xf4d27a;
    const geometry = type === 'piercing' ? new THREE.BoxGeometry(.035, .035, .75) : new THREE.RingGeometry(.08, .18, 8);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .72, side: THREE.DoubleSide }));
    mesh.position.copy(position).add(new THREE.Vector3(0, 1.35, 0)); mesh.rotation.x = Math.PI / 2;
    this.add(mesh, type === 'blunt' ? .42 : .25, new THREE.Vector3(0, type === 'blunt' ? .35 : .1, 0));
  }

  resurrection(position: THREE.Vector3): void {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.35, .48, 24), new THREE.MeshBasicMaterial({ color: 0x8fffd2, transparent: true, opacity: .8, side: THREE.DoubleSide }));
    ring.position.copy(position).add(new THREE.Vector3(0, .04, 0)); ring.rotation.x = -Math.PI / 2;
    this.add(ring, .9, new THREE.Vector3(0, .15, 0));
  }

  update(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]; effect.age += dt; effect.root.position.addScaledVector(effect.velocity, dt);
      effect.root.scale.setScalar(1 + effect.age * 1.5);
      const material = (effect.root as THREE.Mesh).material as THREE.MeshBasicMaterial; material.opacity = Math.max(0, 1 - effect.age / effect.duration);
      if (effect.age >= effect.duration) { this.scene.remove(effect.root); material.dispose(); (effect.root as THREE.Mesh).geometry.dispose(); this.effects.splice(i, 1); }
    }
  }

  private add(root: THREE.Object3D, duration: number, velocity: THREE.Vector3): void {
    if (this.effects.length >= this.cap) {
      const oldest = this.effects.shift()!; this.scene.remove(oldest.root);
      const mesh = oldest.root as THREE.Mesh; mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
    }
    this.scene.add(root); this.effects.push({ root, age: 0, duration, velocity });
  }
}
