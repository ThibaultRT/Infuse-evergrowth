import * as THREE from 'three';
import type { AreaDefinition } from '../types';
import { quaterniusAssets, type AssetLoader } from './AssetLoader';

const model = (group: 'nature' | 'village', name: string): string => `${group}/models/${name}.gltf`;

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  return object;
}

type Placement = readonly [path: string, x: number, z: number, scale?: number, rotation?: number];

export class EnvironmentView {
  readonly root = new THREE.Group();
  private readonly proceduralDetails = new THREE.Group();

  constructor(readonly area: AreaDefinition, private readonly assets: AssetLoader = quaterniusAssets) {
    this.root.position.set(area.originX, 0, area.originZ);
    if (area.environmentTheme === 'sunlit-meadow') this.buildSunlitMeadow();
    else if (area.environmentTheme === 'ashwood') this.buildAshwood();
    else if (area.environmentTheme === 'flat') this.buildFlatSurface();
    else this.buildLegacyGround();
  }

  private buildAshwood(): void {
    const ground = mesh(new THREE.PlaneGeometry(38, 56, 8, 12), new THREE.MeshStandardMaterial({ color: 0x3d493c, roughness: 1 }), 0, 0, 0);
    ground.rotation.x = -Math.PI / 2;
    const road = mesh(new THREE.PlaneGeometry(5.5, 56), new THREE.MeshStandardMaterial({ color: 0x564d43, roughness: 1 }), 0, .012, 0);
    road.rotation.x = -Math.PI / 2;
    const bark = new THREE.MeshStandardMaterial({ color: 0x29241f, roughness: 1 });
    const ember = new THREE.MeshStandardMaterial({ color: 0x803b22, emissive: 0x5a1908, emissiveIntensity: .22, roughness: .9 });
    const details = new THREE.Group();
    for (const [x, z, height] of [[-15,-20,4],[14,-15,3.5],[-13,-6,3],[15,3,4],[-14,15,3.6],[12,21,4.2]] as const) {
      const trunk = mesh(new THREE.CylinderGeometry(.2, .38, height, 7), bark, x, height / 2, z);
      trunk.rotation.z = (x + z) * .006; details.add(trunk);
      const coal = mesh(new THREE.DodecahedronGeometry(.35), ember, x + .3, .24, z + .2); details.add(coal);
    }
    this.root.add(ground, road, details);
  }

  private buildFlatSurface(): void {
    const ground = mesh(new THREE.PlaneGeometry(38, 56), new THREE.MeshStandardMaterial({ color: 0x68745f, roughness: 1 }), 0, 0, 0);
    ground.rotation.x = -Math.PI / 2;
    this.root.add(ground);
  }

  private buildLegacyGround(): void {
    const ground = mesh(new THREE.PlaneGeometry(38, 56), new THREE.MeshStandardMaterial({ color: 0x5d8556, roughness: .95 }), 0, 0, 0);
    ground.rotation.x = -Math.PI / 2;
    const path = mesh(new THREE.PlaneGeometry(6, 50), new THREE.MeshStandardMaterial({ color: 0x879574, roughness: 1 }), 0, .012, 0);
    path.rotation.x = -Math.PI / 2;
    this.root.add(ground, path);
  }

  private buildSunlitMeadow(): void {
    const meadow = mesh(new THREE.PlaneGeometry(38, 56, 8, 12), new THREE.MeshStandardMaterial({ color: 0x6f9b55, roughness: .96 }), 0, 0, 0);
    meadow.rotation.x = -Math.PI / 2;
    this.root.add(meadow, this.proceduralDetails);
    this.buildProceduralFallback();
    void this.loadQuaterniusDetails();
  }

  private buildProceduralFallback(): void {
    const earth = new THREE.MeshStandardMaterial({ color: 0xa18d63, roughness: 1 });
    for (let z = -22; z <= 22; z += 4) {
      const path = mesh(new THREE.CylinderGeometry(2.3, 2.5, .045, 12), earth, Math.sin(z * .19) * 1.25, .045, z);
      path.scale.z = .78; this.proceduralDetails.add(path);
    }
    const stone = new THREE.MeshStandardMaterial({ color: 0x7b7d72, roughness: .96 });
    this.proceduralDetails.add(mesh(new THREE.BoxGeometry(7.5, 1.05, .65), stone, -10.8, .52, 4.8));
    const wood = new THREE.MeshStandardMaterial({ color: 0x704a2e, roughness: .93 });
    for (const z of [-10, -6, -2, 2]) this.proceduralDetails.add(mesh(new THREE.BoxGeometry(.2, 1.2, .2), wood, 15.2, .6, z));
    const trunk = new THREE.MeshStandardMaterial({ color: 0x5b3c28, roughness: 1 });
    const leaves = new THREE.MeshStandardMaterial({ color: 0x356d3e, roughness: .9 });
    for (const [x, z, scale] of [[-16, -15, 1.1], [-15, -5, .85], [15, 8, 1], [14, 17, 1.2], [-11, 22, .9], [11, -22, 1]] as const) {
      const tree = new THREE.Group();
      tree.add(mesh(new THREE.CylinderGeometry(.16, .25, 1.7, 7), trunk, 0, .85, 0), mesh(new THREE.IcosahedronGeometry(.9, 1), leaves, 0, 2, 0));
      tree.position.set(x, 0, z); tree.scale.setScalar(scale); this.proceduralDetails.add(tree);
    }
  }

  private async loadQuaterniusDetails(): Promise<void> {
    const placements: Placement[] = [
      [model('nature', 'CommonTree_1'), -16, -15, .92, .2], [model('nature', 'CommonTree_3'), -15, -5, .72, 1.4],
      [model('nature', 'CommonTree_1'), 15, 8, .82, -1], [model('nature', 'CommonTree_3'), 14, 17, .82, .5],
      [model('nature', 'CommonTree_1'), -11, 22, .72, 2], [model('nature', 'CommonTree_3'), 11, -22, .75, -2],
      [model('nature', 'Rock_Medium_1'), -16, 5, 1.2, .4], [model('nature', 'Rock_Medium_2'), 16, 7, 1.1, 1.5],
      [model('nature', 'Rock_Medium_2'), -13, 10, .8, -.7], [model('nature', 'Rock_Medium_1'), 13, 10, .7, 2],
      [model('nature', 'Bush_Common_Flowers'), -11, -9, .8], [model('nature', 'Bush_Common_Flowers'), 12, 10, .9, 1.2],
      [model('nature', 'Flower_3_Group'), -8, -4, .8], [model('nature', 'Flower_3_Group'), 9, -17, .75, 2.1],
      [model('nature', 'Grass_Common_Short'), -12, 16, 1.1], [model('nature', 'Grass_Common_Short'), 14, -8, 1.15, .8],
      [model('village', 'Prop_WoodenFence_Single'), 15.2, -9, 1, Math.PI / 2],
      [model('village', 'Prop_WoodenFence_Extension1'), 15.2, -5, 1, Math.PI / 2],
      [model('village', 'Prop_WoodenFence_Extension1'), 15.2, -1, 1, Math.PI / 2],
      [model('village', 'Prop_Brick1'), -11, 5, 1.2, .4], [model('village', 'Prop_Brick1'), -13, 8, 1, 2.2]
    ];
    for (let z = -22; z <= 22; z += 3.8) placements.push([model('nature', 'RockPath_Round_Wide'), Math.sin(z * .19) * 1.25, z, 1.15, z * .025]);
    try {
      const [objects, pavement] = await Promise.all([
        Promise.all(placements.map(async ([path, x, z, scale = 1, rotation = 0]) => {
          const object = await this.assets.cloneScene(path);
          object.position.set(x, .025, z); object.scale.setScalar(scale); object.rotation.y = rotation;
          return object;
        })),
        this.buildPavement()
      ]);
      this.root.add(pavement, ...objects);
      this.proceduralDetails.visible = false;
    } catch (error) {
      console.warn('Quaternius Area 1 assets unavailable; keeping procedural environment.', error);
    }
  }

  private async buildPavement(): Promise<THREE.Object3D> {
    const pavement = await this.assets.cloneScene(model('village', 'Floor_UnevenBrick'));
    pavement.name = 'area-1-stone-pavement';
    pavement.position.y = .018;
    pavement.scale.set(19, 1, 28);
    pavement.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const tiled = materials.map((source) => {
        const material = source.clone() as THREE.MeshStandardMaterial;
        for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
          const texture = material[key];
          if (!texture) continue;
          material[key] = texture.clone();
          material[key]!.wrapS = material[key]!.wrapT = THREE.RepeatWrapping;
          material[key]!.repeat.set(19, 28);
          material[key]!.needsUpdate = true;
        }
        return material;
      });
      child.material = Array.isArray(child.material) ? tiled : tiled[0];
    });
    return pavement;
  }
}
