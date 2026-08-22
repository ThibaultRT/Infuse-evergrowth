import * as THREE from 'three';
import type { Tier } from '../types';
import { makeHumanoid } from '../visuals';
import { AnimatedHumanoidView } from './AnimatedHumanoidView';

const OUTFIT_BY_TIER: Record<Exclude<Tier, 'crystal'>, string> = {
  common: 'Male_Peasant',
  uncommon: 'Male_Peasant',
  rare: 'Male_Ranger',
  epic: 'Male_Ranger',
  legendary: 'Male_Ranger'
};

const SCALE_BY_TIER: Record<Exclude<Tier, 'crystal'>, number> = {
  common: 1, uncommon: 1.03, rare: 1.07, epic: 1.12, legendary: 1.22
};

/** Rendering-only rarity mapping; it deliberately does not imply a complete armor progression. */
export class EnemyView extends AnimatedHumanoidView {
  constructor(readonly tier: Exclude<Tier, 'crystal'>, accent: number) {
    super(makeHumanoid(accent));
    this.root.scale.setScalar(SCALE_BY_TIER[tier]);
    void this.loadModel(`characters/models/${OUTFIT_BY_TIER[tier]}.gltf`);
  }

  update(dt: number, moving: boolean, active: boolean): void {
    this.setMotion(moving ? 'jog' : 'idle');
    this.updateAnimation(dt, active);
  }

  protected override async onModelReady(): Promise<void> {
    const headBone = this.model?.getObjectByName('Head');
    if (!headBone) return;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(.115, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xd4a27e, roughness: .88 })
    );
    head.position.y = .045;
    head.scale.set(1, 1.18, .92);
    headBone.add(head);
  }
}
