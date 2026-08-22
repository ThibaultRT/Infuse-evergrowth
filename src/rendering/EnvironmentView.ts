import * as THREE from 'three';
import type { AreaDefinition } from '../types';

const shadow = (object: THREE.Object3D): void => object.traverse((child) => {
  if (child instanceof THREE.Mesh) { child.castShadow = true; child.receiveShadow = true; }
});

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function makeTree(x: number, z: number, scale: number, trunk: THREE.Material, leaves: THREE.Material): THREE.Group {
  const tree = new THREE.Group();
  const trunkMesh = mesh(new THREE.CylinderGeometry(.16, .25, 1.7, 7), trunk, 0, .85, 0);
  const crown = mesh(new THREE.IcosahedronGeometry(.9, 1), leaves, 0, 2, 0);
  crown.scale.set(1, 1.25, 1);
  tree.add(trunkMesh, crown);
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  return tree;
}

export class EnvironmentView {
  readonly root = new THREE.Group();

  constructor(readonly area: AreaDefinition) {
    this.root.position.set(area.originX, 0, area.originZ);
    if (area.environmentTheme === 'sunlit-meadow') this.buildSunlitMeadow();
    else this.buildLegacyGround();
  }

  private buildLegacyGround(): void {
    const ground = mesh(new THREE.PlaneGeometry(38, 56), new THREE.MeshStandardMaterial({ color: 0x5d8556, roughness: .95 }), 0, 0, 0);
    ground.rotation.x = -Math.PI / 2;
    const path = mesh(new THREE.PlaneGeometry(6, 50), new THREE.MeshStandardMaterial({ color: 0x879574, roughness: 1 }), 0, .012, 0);
    path.rotation.x = -Math.PI / 2;
    this.root.add(ground, path);
  }

  private buildSunlitMeadow(): void {
    const grass = new THREE.MeshStandardMaterial({ color: 0x6f9b55, roughness: .96 });
    const meadow = mesh(new THREE.PlaneGeometry(38, 56, 8, 12), grass, 0, 0, 0);
    meadow.rotation.x = -Math.PI / 2;
    this.root.add(meadow);

    const earth = new THREE.MeshStandardMaterial({ color: 0xa18d63, roughness: 1 });
    const verge = new THREE.MeshStandardMaterial({ color: 0x8b7a59, roughness: 1 });
    for (let z = -23; z <= 23; z += 4) {
      const x = Math.sin(z * .19) * 1.25;
      const edge = mesh(new THREE.CylinderGeometry(2.6, 2.8, .035, 12), verge, x, .02, z);
      const path = mesh(new THREE.CylinderGeometry(2.25, 2.45, .045, 12), earth, x, .045, z);
      edge.scale.z = .8;
      path.scale.z = .78;
      this.root.add(edge, path);
    }

    const stone = new THREE.MeshStandardMaterial({ color: 0x8b8b79, roughness: .94 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x666b61, roughness: .98 });
    const ruin = new THREE.Group();
    ruin.add(
      mesh(new THREE.BoxGeometry(7.5, 1.05, .65), stone, -10.8, .52, 4.8),
      mesh(new THREE.BoxGeometry(.7, 2.8, 5.8), stoneDark, -14.2, 1.4, 7.4),
      mesh(new THREE.BoxGeometry(3.2, 2.15, .7), stone, -12.6, 1.08, 10),
      mesh(new THREE.BoxGeometry(2.2, .45, .8), stoneDark, -9, .25, 5.1)
    );
    ruin.rotation.y = -.08;
    shadow(ruin);
    this.root.add(ruin);

    const wood = new THREE.MeshStandardMaterial({ color: 0x704a2e, roughness: .93 });
    const fence = new THREE.Group();
    for (const z of [-10, -6, -2, 2]) {
      fence.add(mesh(new THREE.CylinderGeometry(.1, .13, 1.2, 6), wood, 15.2, .6, z));
      if (z < 2) fence.add(mesh(new THREE.BoxGeometry(.16, .18, 4), wood, 15.2, .72, z + 2));
    }
    shadow(fence);
    this.root.add(fence);

    const trunk = new THREE.MeshStandardMaterial({ color: 0x5b3c28, roughness: 1 });
    const leaves = new THREE.MeshStandardMaterial({ color: 0x356d3e, roughness: .9 });
    const trees = [[-16, -15, 1.1], [-15, -5, .85], [15, 8, 1], [14, 17, 1.2], [-11, 22, .9], [11, -22, 1]] as const;
    trees.forEach(([x, z, scale]) => this.root.add(makeTree(x, z, scale, trunk, leaves)));

    const bushGeometry = new THREE.IcosahedronGeometry(.48, 1);
    const bushMaterial = new THREE.MeshStandardMaterial({ color: 0x477f42, roughness: .94 });
    const flowerGeometry = new THREE.SphereGeometry(.075, 6, 5);
    const flowerMaterials = [0xf5d76e, 0xf4a7b9, 0xe9edf5].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .8 }));
    const accents = [[-11, -9], [-8, -4], [10, 4], [12, 10], [-12, 16], [9, -17], [14, -8]] as const;
    accents.forEach(([x, z], index) => {
      const bush = mesh(bushGeometry, bushMaterial, x, .35, z);
      bush.scale.set(1.5, .75, 1);
      this.root.add(bush);
      for (let petal = 0; petal < 3; petal++) this.root.add(mesh(flowerGeometry, flowerMaterials[(index + petal) % flowerMaterials.length], x - .5 + petal * .38, .16, z + .7));
    });
  }
}
