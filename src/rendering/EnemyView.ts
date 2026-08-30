import * as THREE from 'three';
import type { Tier } from '../types';
import { makeHumanoid } from '../visuals';
import { AnimatedHumanoidView } from './AnimatedHumanoidView';
import { fitModelToHeight, gameModelAssets } from './AssetLoader';
import { disposeOwnedObject } from './RenderingResourceDisposal';

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
  private readonly ownedDetails = new Set<THREE.Object3D>();

  constructor(readonly tier: Exclude<Tier, 'crystal'>, accent: number) {
    super(makeHumanoid(accent));
    this.root.scale.setScalar(SCALE_BY_TIER[tier]);
    if (tier === 'rare') void this.loadRareModel();
    else if (tier === 'epic') void this.loadEpicModel();
    else void this.loadModel(`characters/models/${OUTFIT_BY_TIER[tier]}.gltf`);
  }

  private async loadEpicModel(): Promise<void> {
    try {
      const model = await gameModelAssets.cloneScene('enemies/spider.glb');
      if (this.isDisposed) return;
      fitModelToHeight(model, 2.2 / SCALE_BY_TIER.epic);
      model.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
      this.model = model;
      this.disposeFallback();
      this.root.clear();
      this.root.add(model);
    } catch (error) {
      if (!this.isDisposed) console.warn('Epic spider model unavailable; keeping procedural fallback.', error);
    }
  }

  private async loadRareModel(): Promise<void> {
    try {
      const model = await gameModelAssets.cloneScene('enemies/enemy-rare.glb');
      if (this.isDisposed) return;
      fitModelToHeight(model, 2.7 / SCALE_BY_TIER.rare);
      model.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
      this.model = model;
      this.disposeFallback();
      this.root.clear();
      this.root.add(model);
    } catch (error) {
      if (!this.isDisposed) console.warn('Rare enemy model unavailable; keeping procedural fallback.', error);
    }
  }

  update(dt: number, moving: boolean, active: boolean): void {
    this.setMotion(moving ? 'jog' : 'idle');
    this.updateAnimation(dt, active);
  }

  override dispose(): void {
    this.ownedDetails.forEach((object) => disposeOwnedObject(object));
    this.ownedDetails.clear();
    super.dispose();
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
    this.ownedDetails.add(head);
  }
}
