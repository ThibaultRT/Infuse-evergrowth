import * as THREE from 'three';
import { fitModelToHeight, gameModelAssets } from './AssetLoader';

const SHATTER_DURATION = .45;

/** Presents an intact resource crystal and a short, renderer-only shatter effect. */
export class CrystalView {
  readonly root = new THREE.Group();
  private readonly intact = new THREE.Group();
  private readonly shards = new THREE.Group();
  private readonly shardMaterials: THREE.MeshStandardMaterial[] = [];
  private deathRemaining = 0;

  constructor(color: number, areaId: number) {
    const crystalMaterial = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .25, roughness: .35, metalness: .15 });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(.62, 0), crystalMaterial);
    core.scale.y = 1.55;
    core.position.y = .9;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.42, .62, .28, 7), new THREE.MeshStandardMaterial({ color: 0x53616a, roughness: 1 }));
    base.position.y = .14;
    this.intact.add(core, base);

    for (let index = 0; index < 6; index++) {
      const material = crystalMaterial.clone();
      material.transparent = true;
      this.shardMaterials.push(material);
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(.28 + index % 2 * .08), material);
      const angle = index / 6 * Math.PI * 2;
      shard.position.set(Math.cos(angle) * .18, .65 + index % 3 * .24, Math.sin(angle) * .18);
      shard.userData.direction = new THREE.Vector3(Math.cos(angle), .6 + index % 2 * .25, Math.sin(angle));
      this.shards.add(shard);
    }
    this.shards.visible = false;
    this.root.add(this.intact, this.shards);
    void this.loadModel(areaId);
  }

  private async loadModel(areaId: number): Promise<void> {
    const colorByArea: Record<number, string> = { 1: 'green', 2: 'purple', 3: 'red' };
    const color = colorByArea[areaId];
    if (!color) return;
    try {
      const model = await gameModelAssets.cloneScene(`crystals/crystal_${color}.glb`);
      fitModelToHeight(model, 1.75);
      model.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; } });
      this.intact.clear();
      this.intact.add(model);
    } catch (error) {
      console.warn(`Area ${areaId} crystal model unavailable; keeping procedural fallback.`, error);
    }
  }

  playDeath(): void {
    this.deathRemaining = SHATTER_DURATION;
    this.intact.visible = false;
    this.shards.visible = true;
  }

  reset(): void {
    this.deathRemaining = 0;
    this.intact.visible = true;
    this.shards.visible = false;
    this.shards.children.forEach((shard, index) => {
      const angle = index / 6 * Math.PI * 2;
      shard.position.set(Math.cos(angle) * .18, .65 + index % 3 * .24, Math.sin(angle) * .18);
      shard.rotation.set(0, 0, 0);
      this.shardMaterials[index].opacity = 1;
    });
  }

  update(dt: number): void {
    if (this.deathRemaining <= 0) return;
    this.deathRemaining = Math.max(0, this.deathRemaining - dt);
    const progress = 1 - this.deathRemaining / SHATTER_DURATION;
    this.shards.children.forEach((shard, index) => {
      const direction = shard.userData.direction as THREE.Vector3;
      shard.position.addScaledVector(direction, dt * 2.2);
      shard.position.y -= progress * dt * 3.8;
      shard.rotation.x += dt * (4 + index);
      shard.rotation.z -= dt * (3 + index * .5);
      this.shardMaterials[index].opacity = 1 - progress;
    });
  }
}
