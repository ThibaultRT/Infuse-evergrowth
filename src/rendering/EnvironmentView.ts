import * as THREE from 'three';
import type { AreaDefinition } from '../types';
import { quaterniusAssets, type AssetLoader } from './AssetLoader';

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const value = new THREE.Mesh(geometry, material); value.position.set(x, y, z); return value;
}

/** Permanent macro terrain for one authored world chunk. All three roots remain visible. */
export class EnvironmentView {
  readonly root = new THREE.Group();
  private readonly terrainRoot = new THREE.Group();
  private readonly macroRoot = new THREE.Group();
  private readonly assetDetailsRoot = new THREE.Group();
  private readonly fallbackDetailsRoot = new THREE.Group();

  constructor(readonly area: AreaDefinition, private readonly assets: AssetLoader = quaterniusAssets) {
    this.root.position.set(area.originX, 0, area.originZ);
    this.root.add(this.terrainRoot, this.macroRoot, this.assetDetailsRoot, this.fallbackDetailsRoot);
    if (area.environmentTheme === 'sunlit-meadow') this.buildMeadow();
    else if (area.environmentTheme === 'ashwood') this.buildBorderlands();
    else this.buildRuinedFortress();
    void this.loadDetails();
  }

  private ground(color: number): void {
    const ground = mesh(new THREE.PlaneGeometry(this.area.size.width, this.area.size.depth), new THREE.MeshStandardMaterial({ color, roughness: 1 }), 0, 0, 0);
    ground.rotation.x = -Math.PI / 2; this.terrainRoot.add(ground);
  }

  private road(points: readonly [number, number][], width = 3.4): void {
    const material = new THREE.MeshStandardMaterial({ color: 0xa58b5d, roughness: 1 });
    for (let i = 1; i < points.length; i++) {
      const [ax, az] = points[i - 1], [bx, bz] = points[i];
      const length = Math.hypot(bx - ax, bz - az);
      const piece = mesh(new THREE.PlaneGeometry(width, length), material, (ax + bx) / 2, .025, (az + bz) / 2);
      piece.rotation.x = -Math.PI / 2; piece.rotation.z = -Math.atan2(bx - ax, bz - az); this.macroRoot.add(piece);
    }
  }

  private buildMeadow(): void {
    this.ground(0x79a957);
    this.road([[0, 4], [3, -10], [8, -28]]);
    this.road([[0, 4], [10, 3], [18, 0]]);
    this.road([[0, 4], [-10, 7], [-18, 7]]);
    this.road([[0, 4], [-1, 16], [0, 28]]);
    const water = mesh(new THREE.PlaneGeometry(30, 8.2, 12, 3), new THREE.MeshStandardMaterial({ color: 0x277e9e, roughness: .28, metalness: .05, transparent: true, opacity: .94 }), -3, .06, -27.8);
    water.rotation.x = -Math.PI / 2; this.macroRoot.add(water);
    const rock = new THREE.MeshStandardMaterial({ color: 0x555b4e, roughness: 1 });
    const cliffRock = new THREE.MeshStandardMaterial({ color: 0x626556, roughness: 1 });
    for (let z = -25; z <= 25; z += 4.2) for (const [x, offset] of [[-18.8, 0], [-20.2, 2.1]] as const) {
      const height = 1.5 + Math.sin(z * 1.7 + offset) * .35;
      const cliff = mesh(new THREE.DodecahedronGeometry(1.45, 0), cliffRock, x, height * .62, z + offset); cliff.scale.set(1.35, height, 1.2); cliff.rotation.y = z; this.macroRoot.add(cliff);
    }
    for (const x of [-15, -10, -4, 2, 14]) this.macroRoot.add(mesh(new THREE.DodecahedronGeometry(.8, 0), rock, x, .35, -24.4 + Math.sin(x) * .75));
    const chasmShape = new THREE.Shape();
    chasmShape.moveTo(-22, 0); chasmShape.lineTo(-22, 8); chasmShape.lineTo(-17, 7.2); chasmShape.lineTo(-12, 8.5);
    chasmShape.lineTo(-7, 7.4); chasmShape.lineTo(-2, 8.2); chasmShape.lineTo(4, 7.1); chasmShape.lineTo(10, 8.4);
    chasmShape.lineTo(16, 7.3); chasmShape.lineTo(22, 8); chasmShape.lineTo(22, 0); chasmShape.closePath();
    const chasm = mesh(new THREE.ShapeGeometry(chasmShape), new THREE.MeshStandardMaterial({ color: 0x242720, roughness: 1 }), 0, -.32, 26.3);
    chasm.rotation.x = Math.PI / 2; this.macroRoot.add(chasm);
    for (let x = -17; x <= 17; x += 2.5) {
      if (Math.abs(x) < 2.8) continue;
      const edge = mesh(new THREE.DodecahedronGeometry(.82, 0), rock, x, .18, 27.2 + Math.sin(x * 1.6) * .55); edge.scale.set(1.3, .7, 1); this.macroRoot.add(edge);
    }
    const blockedBridge = mesh(new THREE.BoxGeometry(4, .35, 6), new THREE.MeshStandardMaterial({ color: 0x65452d, roughness: 1 }), 0, .1, 29);
    this.macroRoot.add(blockedBridge, mesh(new THREE.BoxGeometry(4.5, 1.2, .55), rock, 0, .65, 27.5));
  }

  private buildBorderlands(): void {
    this.ground(0x465b42);
    this.road([[-12, 28], [-10, 8], [0, -4]], 3.5);
    this.road([[0, -4], [15, 5], [18, 28]], 3.5);
    const stone = new THREE.MeshStandardMaterial({ color: 0x555850, roughness: 1 });
    for (const [x,z,s] of [[-34,-18,2],[32,-20,2.4],[27,4,1.6],[-30,12,1.8],[12,-22,1.4]] as const) {
      const rock = mesh(new THREE.DodecahedronGeometry(s), stone, x, s * .55, z); rock.scale.y=.7; this.macroRoot.add(rock);
    }
  }

  private wall(x: number, z: number, width: number, depth: number, height = 7): void {
    const stone = new THREE.MeshStandardMaterial({ color: 0x686b62, roughness: 1 });
    const mortar = new THREE.MeshStandardMaterial({ color: 0x4e534f, roughness: 1 });
    const horizontal = width > depth;
    const length = Math.max(width, depth);
    const count = Math.ceil(length / 2.35);
    for (let level = 0; level < Math.ceil(height / 1.05); level++) for (let i = 0; i < count; i++) {
      const along = -length / 2 + (i + .5) * length / count + (level % 2 ? length / count / 2 : 0);
      if (Math.abs(along) > length / 2) continue;
      this.macroRoot.add(mesh(new THREE.BoxGeometry(horizontal ? length / count - .07 : depth, 1, horizontal ? depth : length / count - .07), level % 2 ? stone : mortar,
        x + (horizontal ? along : 0), .5 + level * 1.02, z + (horizontal ? 0 : along)));
    }
    for (let i = 0; i < count; i += 2) {
      const along = -length / 2 + (i + .5) * length / count;
      this.macroRoot.add(mesh(new THREE.BoxGeometry(horizontal ? 1.05 : depth + .25, .75, horizontal ? depth + .25 : 1.05), stone,
        x + (horizontal ? along : 0), height + .25, z + (horizontal ? 0 : along)));
    }
  }

  private buildRuinedFortress(): void {
    this.ground(0x686b61);
    this.road([[-20, 0], [-8, 0], [0, -5], [0, -28]], 4.2);
    this.wall(-20, -15.5, 2.2, 25, 5.2); this.wall(-20, 15.5, 2.2, 25, 5.2);
    this.wall(20, 0, 2.2, 56, 5.8); this.wall(0, 28, 40, 2.2, 5.8);
    this.wall(-11, -28, 17, 2.2, 5.2); this.wall(11, -28, 17, 2.2, 5.2);
    this.wall(4, 8, 10, 2, 4.5); this.wall(10, -11, 2, 12, 5.5);
    const rubble = new THREE.MeshStandardMaterial({ color: 0x777972, roughness: 1 });
    for (const [x,z] of [[-14,8],[-12,-8],[14,14],[8,20],[15,-18],[-5,-19]] as const) this.macroRoot.add(mesh(new THREE.DodecahedronGeometry(1.4), rubble, x, .65, z));
  }

  private async loadDetails(): Promise<void> {
    const path = this.area.id === 2 ? 'nature/models/CommonTree_3.gltf' : 'nature/models/CommonTree_1.gltf';
    const positions = this.area.id === 3 ? [[-13,16],[12,18]] : [[-14,-17],[14,15],[-13,20],[13,-12]];
    try {
      const objects = await Promise.all(positions.map(async ([x,z], index) => {
        const object = await this.assets.cloneScene(path); object.position.set(x, 0, z); object.scale.setScalar(.75 + index * .04); return object;
      }));
      this.assetDetailsRoot.add(...objects); this.fallbackDetailsRoot.visible = false;
    } catch (error) { console.warn(`Area ${this.area.id} details unavailable; macro terrain remains playable.`, error); }
  }
}
