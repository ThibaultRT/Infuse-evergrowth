import * as THREE from 'three';
import { quaterniusAssets, type AssetLoader } from './AssetLoader';

export class GateView {
  readonly root = new THREE.Group();
  private doorPivot = new THREE.Group();
  private readonly fallback = new THREE.Group();
  private openAmount = 0;
  private openTarget = 0;

  constructor(axis: 'x' | 'z', style: 'lake-gate' | 'ruined-fortress-gate', assets: AssetLoader = quaterniusAssets) {
    const stone = new THREE.MeshStandardMaterial({ color: style === 'lake-gate' ? 0x8b846d : 0x686d68, roughness: 1 });
    const darkStone = new THREE.MeshStandardMaterial({ color: 0x454b47, roughness: 1 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x704527, roughness: .92 });
    const makeBlock = (x: number, y: number, z: number, w: number, h: number, d: number, material = stone): THREE.Mesh => {
      const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); block.position.set(x, y, z); return block;
    };
    // Low, broad gatehouses remain readable from the close portrait camera and
    // avoid the previous giant cylinders and incorrectly-scaled imported frame.
    for (const side of [-1, 1]) {
      const x = side * 3.05;
      this.fallback.add(makeBlock(x, 1.35, 0, 1.65, 2.7, 1.8));
      for (let i = -1; i <= 1; i++) this.fallback.add(makeBlock(x + i * .58, 3, 0, .42, .65 + (i === 0 ? .2 : 0), 1.95));
      this.fallback.add(makeBlock(x, .35, 1.15, 2.15, .7, .65, darkStone));
    }
    this.fallback.add(makeBlock(0, 3.15, 0, 4.55, .72, 1.45));
    for (let x = -2; x <= 2; x += 1) this.fallback.add(makeBlock(x, 3.8, 0, .62, .6, 1.5));
    const door = makeBlock(1.15, 1.48, 0, 2.3, 2.75, .22, wood);
    for (let x = -.9; x <= .9; x += .45) door.add(makeBlock(x - 1.15, 0, -.15, .09, 2.7, .09, darkStone));
    this.doorPivot.position.x = -1.15; this.doorPivot.add(door);
    this.fallback.add(this.doorPivot);
    if (style === 'lake-gate') {
      this.fallback.add(makeBlock(0, .1, 2.6, 5, .2, 4, wood));
      for (const x of [-2.25, 2.25]) this.fallback.add(makeBlock(x, .65, 2.6, .14, 1.1, 4.2, wood));
    }
    this.root.add(this.fallback);
    this.root.rotation.y = axis === 'x' ? Math.PI / 2 : 0;
    void this.loadAssetGate(assets, style);
  }

  private async loadAssetGate(assets: AssetLoader, style: 'lake-gate' | 'ruined-fortress-gate'): Promise<void> {
    try {
      const [frame, door] = await Promise.all([assets.cloneScene('village/models/DoorFrame_Round_Brick.gltf'), assets.cloneScene('village/models/Door_4_Round.gltf')]);
      const fit = (object: THREE.Object3D, height: number): void => {
        const box = new THREE.Box3().setFromObject(object); const size = box.getSize(new THREE.Vector3());
        object.scale.setScalar(height / Math.max(size.y, .001)); box.setFromObject(object);
        const center = box.getCenter(new THREE.Vector3()); object.position.sub(center); object.position.y += box.getSize(new THREE.Vector3()).y / 2;
      };
      fit(frame, style === 'lake-gate' ? 4.5 : 5.2); fit(door, style === 'lake-gate' ? 3.35 : 3.9);
      frame.name = 'Quaternius round brick gate frame'; door.name = 'Quaternius round wooden door';
      this.root.add(frame); this.doorPivot.clear(); this.doorPivot.position.set(-1.65, 0, 0); door.position.x += 1.65; this.doorPivot.add(door); this.root.add(this.doorPivot);
      this.fallback.visible = false;
    } catch (error) { console.warn('Quaternius gate unavailable; using procedural safety fallback.', error); }
  }

  setOpen(open: boolean): void { this.openTarget = open ? 1 : 0; }

  update(dt: number): void {
    this.openAmount = THREE.MathUtils.damp(this.openAmount, this.openTarget, 5, dt);
    this.doorPivot.rotation.y = -this.openAmount * Math.PI * .58;
  }
}
