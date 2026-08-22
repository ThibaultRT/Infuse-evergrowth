import * as THREE from 'three';
import { makeHumanoid } from '../visuals';
import { AnimatedHumanoidView } from './AnimatedHumanoidView';

const RANGER = 'characters/models/Male_Ranger.gltf';
const SWORD = 'weapons/models/Sword_Bronze.gltf';

function handFocus(color: number): THREE.Mesh {
  const focus = new THREE.Mesh(
    new THREE.OctahedronGeometry(.055),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .3, roughness: .5 })
  );
  focus.name = 'independent-hand-attachment';
  return focus;
}

export class HeroView extends AnimatedHumanoidView {
  private targetFacing = 0;

  constructor() {
    super(makeHumanoid(0x2f3540, true));
    void this.loadModel(RANGER);
  }

  setFacing(radians: number): void { this.targetFacing = radians; }

  update(dt: number, moving: boolean, active = true): void {
    this.root.rotation.y = THREE.MathUtils.lerp(this.root.rotation.y, this.targetFacing, 1 - Math.exp(-14 * dt));
    this.setMotion(moving ? 'jog' : 'idle');
    this.updateAnimation(dt, active);
  }

  protected override async onModelReady(): Promise<void> {
    this.attach('left', handFocus(0x63d9ff));
    this.attach('right', handFocus(0xffc457));
    try {
      const sword = await this.assets.cloneScene(SWORD);
      sword.name = 'bronze-sword-hand1';
      sword.scale.setScalar(.82);
      sword.position.set(.02, .02, -.04);
      sword.rotation.set(Math.PI / 2, 0, Math.PI);
      this.attach('right', sword);
    } catch (error) {
      console.warn('Bronze sword unavailable; hero hand attachment remains usable.', error);
    }
  }
}
