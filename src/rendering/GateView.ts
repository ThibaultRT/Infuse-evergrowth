import * as THREE from 'three';
import { quaterniusAssets, type AssetLoader } from './AssetLoader';

const FRAME = 'village/models/DoorFrame_Round_Brick.gltf';
const DOOR = 'village/models/Door_4_Round.gltf';

function configure(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; }
  });
}

export class GateView {
  readonly root = new THREE.Group();
  private doorPivot = new THREE.Group();
  private readonly fallback = new THREE.Group();
  private openAmount = 0;
  private openTarget = 0;

  constructor(private readonly assets: AssetLoader = quaterniusAssets) {
    const stone = new THREE.MeshStandardMaterial({ color: 0x77766d, roughness: .95 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x684329, roughness: .9 });
    const left = new THREE.Mesh(new THREE.BoxGeometry(.65, 3.4, .65), stone);
    const right = left.clone();
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, .65, .7), stone);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.05, 2.65, .28), wood);
    left.position.set(-1.35, 1.7, 0); right.position.set(1.35, 1.7, 0); lintel.position.set(0, 3.1, 0);
    door.position.set(1.02, 1.34, 0); this.doorPivot.position.x = -1.02;
    this.doorPivot.add(door); this.fallback.add(left, right, lintel, this.doorPivot);
    configure(this.fallback); this.root.add(this.fallback);
    void this.loadQuaterniusGate();
  }

  setOpen(open: boolean): void { this.openTarget = open ? 1 : 0; }

  update(dt: number): void {
    this.openAmount = THREE.MathUtils.damp(this.openAmount, this.openTarget, 5, dt);
    this.doorPivot.rotation.y = -this.openAmount * Math.PI * .58;
  }

  private async loadQuaterniusGate(): Promise<void> {
    try {
      const [frame, door] = await Promise.all([this.assets.cloneScene(FRAME), this.assets.cloneScene(DOOR)]);
      configure(frame); configure(door);
      const assembly = new THREE.Group();
      assembly.scale.setScalar(1.65);
      const pivot = new THREE.Group();
      pivot.position.x = -.55;
      door.position.x = .55;
      pivot.add(door);
      assembly.add(frame, pivot);
      this.root.add(assembly);
      this.fallback.visible = false;
      this.doorPivot = pivot;
    } catch (error) {
      console.warn('Quaternius gate unavailable; keeping procedural gate.', error);
    }
  }
}
